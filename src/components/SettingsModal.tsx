import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Check, X, ExternalLink } from "lucide-react";
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
import { getGitHubToken, setGitHubToken, removeGitHubToken } from "@/utils/github";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const existingToken = getGitHubToken();
      setHasExistingToken(!!existingToken);
      setToken(existingToken || "");
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
            <p className="text-xs text-muted-foreground">
              Your token is stored locally in your browser and never sent to any server.
            </p>
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
              href="https://github.com/settings/tokens/new?description=InstantIDE&scopes=repo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Generate a new token on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-xs text-muted-foreground mt-1">
              Only "repo" scope is needed for private repositories.
              No scopes needed for public repos.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
