import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Workspace configuration, Google Sheets linking, and BYOK notice."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/40">
          <CardHeader>
            <CardTitle className="text-base">Model provider (BYOK)</CardTitle>
            <CardDescription>
              Bring your own key for Groq or Together.ai. Keys are requested per
              session and never stored on the server. Paste them in the “Connect
              a model provider” dialog, then pick a provider + model per campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Providers:{" "}
            <span className="text-foreground">Groq</span> ·{" "}
            <span className="text-foreground">Together.ai</span> — switchable per
            run.
          </CardContent>
        </Card>

        <Card className="bg-card/40">
          <CardHeader>
            <CardTitle className="text-base">Google Sheets</CardTitle>
            <CardDescription>
              Optional — connect a service account to push qualified leads to a
              sheet in 500-row batches.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Not configured.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
