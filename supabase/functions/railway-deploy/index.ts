import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Updated to the correct Railway API endpoint
const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

interface DeployRequest {
  action: 'create' | 'deploy' | 'status' | 'delete' | 'diagnose';
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

    // GraphQL request helper with token-mode handling
    const graphqlRequest = async (query: string, variables: Record<string, unknown> = {}) => {
      console.log('GraphQL request:', query.slice(0, 100) + '...');
      
      // Try with Bearer token first (account token style)
      let response = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${railwayToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      let data = await response.json();
      
      // If we get an auth error, try with Team-Access-Token header (team token style)
      if (data.errors && data.errors.some((e: { message: string }) => 
        e.message.toLowerCase().includes('unauthorized') || 
        e.message.toLowerCase().includes('forbidden') ||
        e.message.toLowerCase().includes('authentication')
      )) {
        console.log('Bearer token failed, trying Team-Access-Token header...');
        response = await fetch(RAILWAY_API_URL, {
          method: 'POST',
          headers: {
            'Team-Access-Token': railwayToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });
        data = await response.json();
      }

      if (data.errors) {
        // Log detailed error for server-side debugging only
        console.error('Railway GraphQL error:', JSON.stringify(data.errors));
        const errorMsg = data.errors[0]?.message || 'GraphQL request failed';
        throw new Error(errorMsg);
      }
      return data.data;
    };

    switch (body.action) {
      // New diagnose action to check token access and workspace validity
      case 'diagnose': {
        const workspaceId = Deno.env.get('RAILWAY_WORKSPACE_ID');
        const results: {
          tokenValid: boolean;
          workspaceConfigured: boolean;
          workspaceId: string | null;
          workspaceAccessible: boolean;
          workspaceName: string | null;
          availableTeams: Array<{ id: string; name: string }>;
          error: string | null;
        } = {
          tokenValid: false,
          workspaceConfigured: !!workspaceId,
          workspaceId: workspaceId || null,
          workspaceAccessible: false,
          workspaceName: null,
          availableTeams: [],
          error: null,
        };

        try {
          // First, try to get the current user/token info
          const meQuery = `
            query me {
              me {
                id
                email
                teams {
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

          const meResult = await graphqlRequest(meQuery);
          results.tokenValid = true;
          
          // Extract available teams
          if (meResult.me?.teams?.edges) {
            results.availableTeams = meResult.me.teams.edges.map((e: { node: { id: string; name: string } }) => ({
              id: e.node.id,
              name: e.node.name,
            }));
          }

          // Check if configured workspace is accessible
          if (workspaceId) {
            const teamMatch = results.availableTeams.find(t => t.id === workspaceId);
            if (teamMatch) {
              results.workspaceAccessible = true;
              results.workspaceName = teamMatch.name;
            } else {
              results.error = `Workspace ID "${workspaceId}" not found in accessible teams. Available: ${results.availableTeams.map(t => `${t.name} (${t.id})`).join(', ') || 'none'}`;
            }
          }
        } catch (err) {
          results.error = err instanceof Error ? err.message : 'Unknown error during diagnosis';
        }

        return new Response(
          JSON.stringify(results),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

        let projectResult;
        try {
          projectResult = await graphqlRequest(createProjectQuery, {
            input: {
              name: cleanRepo,
              teamId: workspaceId,
            }
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          // Provide more helpful error for workspace issues
          if (errMsg.toLowerCase().includes('workspace') || errMsg.toLowerCase().includes('team')) {
            return new Response(
              JSON.stringify({ 
                error: `Cannot access workspace. Run "Diagnose" to check your token's team access. Error: ${errMsg}` 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw err;
        }

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
    // Return the actual error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
