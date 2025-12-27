import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

interface DeployRequest {
  action: 'create' | 'deploy' | 'status' | 'delete';
  githubUrl?: string;
  projectId?: string;
  serviceId?: string;
  deploymentId?: string;
}

// Validate GitHub owner/repo names match GitHub's allowed patterns
function isValidGitHubName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 100) return false;
  const validPattern = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/;
  if (!validPattern.test(name)) return false;
  if (name.includes('..')) return false;
  return true;
}

// Map internal errors to safe user-friendly messages
function getSafeErrorMessage(error: Error): string {
  const errorMsg = error.message.toLowerCase();
  
  if (errorMsg.includes('unauthorized') || errorMsg.includes('authentication') || errorMsg.includes('forbidden')) {
    return 'Railway authentication failed. Please check your configuration.';
  }
  if (errorMsg.includes('workspace') || errorMsg.includes('team')) {
    return 'Railway workspace not found. Please verify your workspace configuration.';
  }
  if (errorMsg.includes('repository') || errorMsg.includes('repo') || errorMsg.includes('not found')) {
    return 'Unable to access the repository. Verify it exists and is public.';
  }
  if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('rate')) {
    return 'Deployment quota exceeded. Please try again later.';
  }
  if (errorMsg.includes('invalid') || errorMsg.includes('validation')) {
    return 'Invalid request. Please check your input and try again.';
  }
  
  return 'Deployment failed. Please check your configuration and try again.';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Note: This function is public (verify_jwt = false in config.toml)
    // Security is provided by Railway API token validation (server-side secret)
    // and GitHub URL validation
    
    const railwayToken = Deno.env.get('RAILWAY_API_TOKEN');
    if (!railwayToken) {
      console.error('RAILWAY_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Railway API token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: DeployRequest = await req.json();
    console.log('Railway deploy request:', body.action);

    const graphqlRequest = async (query: string, variables: Record<string, unknown> = {}) => {
      console.log('GraphQL request:', query.slice(0, 100) + '...');
      const response = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${railwayToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      const data = await response.json();
      if (data.errors) {
        // Log detailed error for server-side debugging only
        console.error('Railway GraphQL error:', JSON.stringify(data.errors));
        throw new Error(data.errors[0]?.message || 'GraphQL request failed');
      }
      return data.data;
    };

    switch (body.action) {
      case 'create': {
        if (!body.githubUrl) {
          return new Response(
            JSON.stringify({ error: 'GitHub URL is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate URL length
        if (body.githubUrl.trim().length > 500) {
          return new Response(
            JSON.stringify({ error: 'Invalid GitHub URL' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Parse GitHub URL
        const match = body.githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
          return new Response(
            JSON.stringify({ error: 'Invalid GitHub URL format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const [, owner, repo] = match;
        const cleanRepo = repo.replace(/\.git$/, '');
        
        // Validate owner and repo names match GitHub's allowed patterns
        if (!isValidGitHubName(owner) || !isValidGitHubName(cleanRepo)) {
          return new Response(
            JSON.stringify({ error: 'Invalid GitHub owner or repository name' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const repoFullName = `${owner}/${cleanRepo}`;
        console.log('Creating project for repo:', repoFullName);

        // Get workspace ID from secret
        const workspaceId = Deno.env.get('RAILWAY_WORKSPACE_ID');
        if (!workspaceId) {
          console.error('RAILWAY_WORKSPACE_ID not configured');
          return new Response(
            JSON.stringify({ error: 'Railway workspace ID not configured. Please add RAILWAY_WORKSPACE_ID secret.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('Using workspace ID:', workspaceId);

        // Step 1: Create a new project with teamId
        const createProjectQuery = `
          mutation projectCreate($input: ProjectCreateInput!) {
            projectCreate(input: $input) {
              id
              name
            }
          }
        `;

        const projectResult = await graphqlRequest(createProjectQuery, {
          input: {
            name: cleanRepo,
            teamId: workspaceId,
          }
        });

        const projectId = projectResult.projectCreate.id;
        console.log('Created project:', projectId);

        // Step 2: Get the default environment
        const getEnvironmentsQuery = `
          query project($id: String!) {
            project(id: $id) {
              environments {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        `;

        const envResult = await graphqlRequest(getEnvironmentsQuery, { id: projectId });
        const environments = envResult.project.environments.edges;
        const productionEnv = environments.find((e: { node: { name: string } }) => 
          e.node.name.toLowerCase() === 'production'
        ) || environments[0];
        
        const environmentId = productionEnv?.node?.id;
        console.log('Using environment:', environmentId);

        // Step 3: Create a service from GitHub repo
        const createServiceQuery = `
          mutation serviceCreate($input: ServiceCreateInput!) {
            serviceCreate(input: $input) {
              id
              name
            }
          }
        `;

        const serviceResult = await graphqlRequest(createServiceQuery, {
          input: {
            projectId,
            name: cleanRepo,
            source: {
              repo: repoFullName
            }
          }
        });

        const serviceId = serviceResult.serviceCreate.id;
        console.log('Created service:', serviceId);

        // Step 4: Create a service instance to trigger deployment
        const createInstanceQuery = `
          mutation serviceInstanceDeploy($serviceId: String!, $environmentId: String!) {
            serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
          }
        `;

        await graphqlRequest(createInstanceQuery, {
          serviceId,
          environmentId
        });

        console.log('Triggered deployment for service:', serviceId);

        return new Response(
          JSON.stringify({
            success: true,
            projectId,
            serviceId,
            environmentId,
            message: 'Project created and deployment triggered'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        if (!body.projectId || !body.serviceId) {
          return new Response(
            JSON.stringify({ error: 'projectId and serviceId are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get latest deployment status
        const getDeploymentsQuery = `
          query deployments($projectId: String!, $serviceId: String!) {
            deployments(
              first: 1
              input: {
                projectId: $projectId
                serviceId: $serviceId
              }
            ) {
              edges {
                node {
                  id
                  status
                  createdAt
                  staticUrl
                }
              }
            }
          }
        `;

        const deploymentsResult = await graphqlRequest(getDeploymentsQuery, {
          projectId: body.projectId,
          serviceId: body.serviceId
        });

        const latestDeployment = deploymentsResult.deployments.edges[0]?.node;
        
        // Get service domain
        const getServiceQuery = `
          query service($id: String!) {
            service(id: $id) {
              id
              name
              serviceInstances {
                edges {
                  node {
                    domains {
                      serviceDomains {
                        domain
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const serviceResult = await graphqlRequest(getServiceQuery, { id: body.serviceId });
        const serviceDomains = serviceResult.service?.serviceInstances?.edges?.[0]?.node?.domains?.serviceDomains || [];
        const domain = serviceDomains[0]?.domain;

        return new Response(
          JSON.stringify({
            deployment: latestDeployment,
            domain: domain ? `https://${domain}` : null,
            status: latestDeployment?.status || 'UNKNOWN'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!body.projectId) {
          return new Response(
            JSON.stringify({ error: 'projectId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const deleteProjectQuery = `
          mutation projectDelete($id: String!) {
            projectDelete(id: $id)
          }
        `;

        await graphqlRequest(deleteProjectQuery, { id: body.projectId });

        return new Response(
          JSON.stringify({ success: true, message: 'Project deleted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    // Log detailed error for server-side debugging
    console.error('Railway deploy error:', error);
    // Return safe, generic message to client
    const safeMessage = error instanceof Error ? getSafeErrorMessage(error) : 'An error occurred';
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
