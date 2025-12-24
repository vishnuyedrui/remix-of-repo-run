import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Check, X, ExternalLink, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getGitHubToken, setGitHubToken, removeGitHubToken, getUseSessionStorage, setUseSessionStorage } from "@/utils/github";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [useSession, setUseSession] = useState(false);

  useEffect(() => {
    if (open) {
      const existingToken = getGitHubToken();
      setHasExistingToken(!!existingToken);
      setToken(existingToken || "");
      setUseSession(getUseSessionStorage());
      setSaved(false);
    }
  }, [open]);

  const handleSave = () => {
    if (token.trim()) {
      setGitHubToken(token.trim());
      setHasExistingToken(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleRemove = () => {
    removeGitHubToken();
    setToken("");
    setHasExistingToken(false);
  };

  const handleSessionToggle = (checked: boolean) => {
    setUseSessionStorage(checked);
    setUseSession(checked);
    // If switching storage type and token exists, migrate it
    if (token.trim()) {
      setGitHubToken(token.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your GitHub Personal Access Token to increase API rate limits
            from 60 to 5,000 requests per hour.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="token" className="flex items-center justify-between">
              <span>GitHub Personal Access Token</span>
              {hasExistingToken && (
                <span className="text-xs text-primary flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Token saved
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showToken ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Your token is stored locally and never sent to any server.</p>
              <p><strong>Security tip:</strong> Use minimal scopes — only "public_repo" for public repositories, or "repo" for private ones.</p>
            </div>
          </div>

          {/* Session storage toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="space-y-0.5">
              <Label htmlFor="session-storage" className="text-sm">Clear token on tab close</Label>
              <p className="text-xs text-muted-foreground">Use session storage for shorter persistence</p>
            </div>
            <Switch
              id="session-storage"
              checked={useSession}
              onCheckedChange={handleSessionToggle}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={!token.trim() || saved}
              className="flex-1"
            >
              {saved ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Saved!
                </span>
              ) : (
                "Save Token"
              )}
            </Button>
            {hasExistingToken && (
              <Button
                variant="outline"
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="pt-4 border-t border-border/50">
            <a
              href="https://github.com/settings/tokens/new?description=InstantIDE&scopes=public_repo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Generate a new token on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-xs text-muted-foreground mt-1">
              Use "public_repo" scope for public repos only, or "repo" for private.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}