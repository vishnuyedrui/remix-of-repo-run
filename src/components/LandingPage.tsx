import { useState, useEffect, memo } from "react";
import { motion } from "motion/react";
import { Github, Rocket, Settings, Code2, Terminal as TerminalIcon, Heart, CreditCard, Cloud, Monitor, Eye, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsModal } from "./SettingsModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useWorkspaceStore, DeploymentMode } from "@/store/useWorkspaceStore";
import {
  parseGitHubUrl,
  fetchRepoTree,
  transformToNestedTree,
  buildFileSystemTree,
} from "@/utils/github";
import { detectProjectType } from "@/utils/projectDetection";
import { runFullWorkflow } from "@/utils/webcontainer";

const features = [
  {
    icon: Code2,
    title: 'Monaco Editor',
    description: 'VS Code-style code viewing with syntax highlighting',
    delay: 0.1
  },
  {
    icon: TerminalIcon,
    title: 'Live Terminal',
    description: 'Full terminal with real-time npm output',
    delay: 0.2
  },
  {
    icon: Eye,
    title: 'Instant Preview',
    description: 'Watch your app come to life in seconds',
    delay: 0.3
  }
];

const faqs = [
  {
    question: 'What is InstantIDE?',
    answer: 'InstantIDE is an online platform that allows users to instantly preview, run, and explore projects directly from GitHub repositories without any complex local setup. It is designed to make learning, testing, and showcasing code simple and fast.'
  },
  {
    question: 'Which types of projects are supported?',
    answer: 'InstantIDE supports frontend projects such as HTML, CSS, and JavaScript, as well as backend and full-stack projects including Node.js applications. The platform automatically detects the project type and runs it accordingly.'
  },
  {
    question: 'Do I need to install anything to use InstantIDE?',
    answer: 'No installation is required. Everything runs directly in the browser, so you can preview and interact with projects without setting up environments, dependencies, or tools on your local machine.'
  },
  {
    question: 'Can InstantIDE run Node.js and backend projects?',
    answer: 'Yes, InstantIDE supports Node.js projects. If a project includes a Docker file, it will be used automatically. If not, the platform can generate a default setup to run the project smoothly.'
  },
  {
    question: 'How does InstantIDE handle project assets like images and files?',
    answer: 'InstantIDE intelligently resolves and serves project assets, ensuring that images, styles, and scripts load correctly even when previewing projects directly from GitHub repositories.'
  },
  {
    question: 'Is InstantIDE suitable for beginners?',
    answer: 'Absolutely. InstantIDE is beginner-friendly and ideal for students and learners who want to explore projects, understand code structure, and see live results without worrying about configuration or errors.'
  },
  {
    question: 'Can I use InstantIDE to showcase my projects?',
    answer: 'Yes, InstantIDE is perfect for showcasing projects. You can share live previews of your GitHub repositories, making it easier for recruiters, mentors, or peers to view and test your work instantly.'
  },
  {
    question: 'Does InstantIDE support real-time updates or changes?',
    answer: 'When you update your GitHub repository, InstantIDE reflects those changes in the preview, ensuring that your live project always stays up to date.'
  },
  {
    question: 'Is InstantIDE free to use?',
    answer: 'InstantIDE offers free access with essential features. Additional advanced features and capabilities may be included in future premium plans.'
  },
  {
    question: "How can I get support if something doesn't work?",
    answer: "If you face any issues, you can reach out through the platform's support or community channels. The goal is to ensure smooth previews and a reliable development experience."
  }
];

export function LandingPage() {
  const [url, setUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Show donate popup once per session after 0.5s delay
  useEffect(() => {
    const hasSeenDonate = sessionStorage.getItem("hasSeenDonate");
    if (!hasSeenDonate) {
      const timer = setTimeout(() => {
        setShowDonate(true);
        sessionStorage.setItem("hasSeenDonate", "true");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handlePayment = () => {
    window.location.href = "https://rzp.io/rzp/bkbe8jK";
  };
  
  // Use atomic selectors for better performance
  const isLoadingRepo = useWorkspaceStore((s) => s.isLoadingRepo);
  const loadingProgress = useWorkspaceStore((s) => s.loadingProgress);
  const error = useWorkspaceStore((s) => s.error);
  const deploymentMode = useWorkspaceStore((s) => s.deploymentMode);
  const setRepoInfo = useWorkspaceStore((s) => s.setRepoInfo);
  const setProjectInfo = useWorkspaceStore((s) => s.setProjectInfo);
  const setFileTree = useWorkspaceStore((s) => s.setFileTree);
  const setFileSystemTree = useWorkspaceStore((s) => s.setFileSystemTree);
  const setIsLoadingRepo = useWorkspaceStore((s) => s.setIsLoadingRepo);
  const setLoadingProgress = useWorkspaceStore((s) => s.setLoadingProgress);
  const setError = useWorkspaceStore((s) => s.setError);
  const setView = useWorkspaceStore((s) => s.setView);
  const setContainerStatus = useWorkspaceStore((s) => s.setContainerStatus);
  const appendTerminalOutput = useWorkspaceStore((s) => s.appendTerminalOutput);
  const clearTerminalOutput = useWorkspaceStore((s) => s.clearTerminalOutput);
  const setPreviewUrl = useWorkspaceStore((s) => s.setPreviewUrl);
  const setDeploymentMode = useWorkspaceStore((s) => s.setDeploymentMode);

  const handleLaunch = async () => {
    if (!url.trim()) {
      setError("Please enter a GitHub repository URL");
      return;
    }

    const parsed = parseGitHubUrl(url.trim());
    if (!parsed) {
      setError("Invalid GitHub URL. Please use format: https://github.com/owner/repo");
      return;
    }

    setError(null);
    setIsLoadingRepo(true);
    setLoadingProgress(null);
    clearTerminalOutput();

    try {
      const { files, sha } = await fetchRepoTree(parsed.owner, parsed.repo, parsed.branch);
      const projectInfo = detectProjectType(files);
      const nestedTree = transformToNestedTree(files);
      const fsTree = await buildFileSystemTree(
        parsed.owner,
        parsed.repo,
        sha,
        files,
        (current, total, fileName) => {
          setLoadingProgress({ current, total, fileName });
        }
      );

      setRepoInfo(parsed);
      setProjectInfo(projectInfo);
      setFileTree(nestedTree);
      setFileSystemTree(fsTree);
      setView("workspace");
      setIsLoadingRepo(false);
      setLoadingProgress(null);

      if (deploymentMode === 'webcontainer') {
        runFullWorkflow(fsTree, {
          onStatusChange: setContainerStatus,
          onOutput: appendTerminalOutput,
          onServerReady: setPreviewUrl,
          onError: (err) => setError(err),
        }, projectInfo.type);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load repository";
      setError(message);
      setIsLoadingRepo(false);
      setLoadingProgress(null);
    }
  };

  const handleModeChange = (value: string) => {
    if (value) {
      setDeploymentMode(value as DeploymentMode);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 text-gray-900 overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-20 w-96 h-96 bg-pink-300/30 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-rose-300/30 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
            x: [0, -50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-200/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 180, 360],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
        {/* Animated Circles */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`circle-${i}`}
            className="absolute w-32 h-32 border-2 border-pink-300/20 rounded-full"
            style={{
              left: `${(i * 15) % 100}%`,
              top: `${(i * 20) % 100}%`,
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.1, 0.3, 0.1],
              rotate: [0, 360],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut"
            }}
          />
        ))}
        
        {/* Animated Lines */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`line-${i}`}
            className="absolute h-px bg-gradient-to-r from-transparent via-pink-300/30 to-transparent"
            style={{
              width: '100%',
              top: `${(i * 20) + 10}%`,
            }}
            animate={{
              x: ['-100%', '100%'],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              delay: i * 2,
              ease: "linear"
            }}
          />
        ))}
        
        {/* Floating Shapes */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`shape-${i}`}
            className="absolute"
            style={{
              left: `${(i * 18 + 10) % 90}%`,
              top: `${(i * 25 + 5) % 90}%`,
            }}
            animate={{
              y: [0, -100, 0],
              rotate: [0, 180, 360],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 8 + i,
              repeat: Infinity,
              delay: i * 0.8,
              ease: "easeInOut"
            }}
          >
            <div className={`w-16 h-16 ${i % 2 === 0 ? 'rounded-full' : 'rounded-lg rotate-45'} bg-gradient-to-br from-pink-300/20 to-rose-300/20 backdrop-blur-sm`} />
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <motion.header
        className="relative z-10 flex items-center justify-between px-8 py-6"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.div 
          className="flex items-center gap-3"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <motion.div
            className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-600 rounded-lg flex items-center justify-center shadow-lg shadow-pink-500/30"
            animate={{
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Rocket className="w-6 h-6 text-white" />
          </motion.div>
          <span className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
            InstantIDE
          </span>
        </motion.div>
        
        <motion.div 
          className="flex items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <motion.button
            className="flex items-center gap-2 text-pink-600 hover:text-pink-500 transition-colors px-3 py-2 rounded-lg hover:bg-pink-100/50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDonate(true)}
          >
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            <span className="hidden sm:inline font-medium">Donate</span>
          </motion.button>
          <motion.button
            whileHover={{ rotate: 180, scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.3 }}
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-pink-100/50 transition-colors"
          >
            <Settings className="w-6 h-6 text-gray-600" />
          </motion.button>
        </motion.div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-8 py-12 md:py-20">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <motion.h1 
            className="text-5xl md:text-7xl font-bold mb-6 text-gray-900"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, type: "spring" }}
          >
            Run any{' '}
            <motion.span
              className="inline-block bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(90deg, #ec4899, #fb7185, #ec4899)',
                backgroundSize: '200% 100%',
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              GitHub repo
            </motion.span>
            <br />
            in your browser
          </motion.h1>
          
          <motion.p
            className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Paste a link. Watch it build. No setup required. Powered by WebContainers.
          </motion.p>

          {/* Mode Toggle */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-4 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <ToggleGroup 
              type="single" 
              value={deploymentMode} 
              onValueChange={handleModeChange}
              className="bg-white/80 backdrop-blur-sm rounded-xl p-1.5 shadow-lg shadow-pink-100/50 border border-pink-200"
            >
              <ToggleGroupItem 
                value="webcontainer" 
                className="gap-2 data-[state=on]:bg-gradient-to-r data-[state=on]:from-pink-500 data-[state=on]:to-rose-500 data-[state=on]:text-white data-[state=on]:shadow-lg px-6 py-3 rounded-lg font-semibold transition-all"
              >
                <Monitor className="w-4 h-4" />
                Quick Preview
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="railway" 
                className="gap-2 data-[state=on]:bg-gradient-to-r data-[state=on]:from-pink-500 data-[state=on]:to-rose-500 data-[state=on]:text-white data-[state=on]:shadow-lg px-6 py-3 rounded-lg font-semibold transition-all"
              >
                <Cloud className="w-4 h-4" />
                Cloud Deploy
              </ToggleGroupItem>
            </ToggleGroup>
          </motion.div>

          <motion.p
            className="text-sm text-pink-500/70 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {deploymentMode === 'webcontainer' 
              ? "Runs instantly in browser via WebContainers (Node.js only)"
              : "Deploys to Railway cloud with full Docker support"
            }
          </motion.p>
        </motion.div>

        {/* URL Input */}
        <motion.div
          className="max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <div className="flex gap-4">
            <motion.div
              className="flex-1 relative"
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Github className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoadingRepo && handleLaunch()}
                placeholder="https://github.com/owner/repo"
                disabled={isLoadingRepo}
                className="w-full pl-14 pr-6 py-5 bg-white backdrop-blur-sm rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none shadow-lg shadow-pink-100/50 border-2 border-pink-200 focus:border-pink-400 transition-colors"
              />
              <motion.div
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 -z-10 blur-xl"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
            
            <motion.button
              className="px-10 py-5 rounded-xl font-semibold text-white shadow-lg flex items-center gap-2 disabled:opacity-50"
              style={{
                background: 'linear-gradient(90deg, #ec4899, #e11d48)',
                boxShadow: '0 10px 15px -3px rgba(236, 72, 153, 0.4)'
              }}
              whileHover={{ 
                scale: 1.05,
                boxShadow: "0 0 40px rgba(236, 72, 153, 0.5)",
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400 }}
              onClick={handleLaunch}
              disabled={isLoadingRepo}
            >
              {isLoadingRepo ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading
                </>
              ) : (
                <>
                  {deploymentMode === 'railway' ? <Cloud className="w-5 h-5" /> : <Rocket className="w-5 h-5" />}
                  {deploymentMode === 'railway' ? 'Deploy' : 'Launch'}
                </>
              )}
            </motion.button>
          </div>

          {/* Error message */}
          {error && (
            <motion.p 
              className="mt-4 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg border border-red-200"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}

          {/* Loading progress */}
          {loadingProgress && (
            <motion.div 
              className="mt-4 space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex justify-between text-sm text-gray-600">
                <span>Downloading files...</span>
                <span>{loadingProgress.current} / {loadingProgress.total}</span>
              </div>
              <div className="h-2 bg-pink-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-gray-500 truncate">
                {loadingProgress.fileName}
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid md:grid-cols-3 gap-8 mb-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              className="relative group"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + feature.delay, duration: 0.6 }}
              whileHover={{ y: -10 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-rose-500/10 rounded-2xl blur-xl"
                whileHover={{ scale: 1.1, opacity: 0.8 }}
                transition={{ duration: 0.3 }}
              />
              <motion.div 
                className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 transition-colors shadow-lg shadow-pink-100/50 border border-pink-200 hover:border-pink-300"
              >
                <motion.div
                  className="w-16 h-16 bg-gradient-to-br from-pink-100 to-rose-100 rounded-xl flex items-center justify-center mb-6 border border-pink-300"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <feature.icon className="w-8 h-8 text-pink-600" />
                </motion.div>
                
                <h3 className="text-xl font-semibold mb-3 text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.h2 
            className="text-4xl font-bold text-center mb-12 bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
          >
            Frequently Asked Questions
          </motion.h2>
          
          <div className="max-w-4xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6 + index * 0.05 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg shadow-pink-100/30 border border-pink-200"
              >
                <motion.button
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-pink-50/50 transition-colors"
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  whileHover={{ backgroundColor: 'rgba(252, 231, 243, 0.3)' }}
                >
                  <span className="font-semibold text-gray-900 pr-8">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openFaqIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-5 h-5 text-pink-500 flex-shrink-0" />
                  </motion.div>
                </motion.button>
                
                <motion.div
                  initial={false}
                  animate={{
                    height: openFaqIndex === index ? 'auto' : 0,
                    opacity: openFaqIndex === index ? 1 : 0
                  }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Floating Particles */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-pink-400/40 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />

      {/* Donate Modal */}
      <Dialog open={showDonate} onOpenChange={setShowDonate}>
        <DialogContent className="sm:max-w-md bg-white border-pink-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              Support InstantIDE
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Help us keep InstantIDE free and improve it for everyone. Your support means a lot!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-gray-600">
              InstantIDE is a free tool that lets you run GitHub repositories directly in your browser. 
              Your donations help cover hosting costs and enable us to add new features.
            </p>
            <motion.button 
              onClick={handlePayment} 
              className="w-full py-3 px-4 rounded-lg font-semibold text-white flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(90deg, #ec4899, #e11d48)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <CreditCard className="w-4 h-4" />
              Donate Now
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy notice footer */}
      <footer className="relative z-10 text-center p-6 text-sm text-gray-500">
        <p>
          This site uses cookies and third-party advertising (Google AdSense) which may collect browsing data.
          By using this site, you consent to this data collection.
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
