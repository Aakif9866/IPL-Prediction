import { ButtonLink, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-xl space-y-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">404</p>
      <h1 className="text-2xl font-bold text-ink">That page isn&apos;t in the scorebook</h1>
      <p className="text-muted">The address may be mistyped, or the batter or report doesn&apos;t exist. The 20 forecast batters are listed on the Batters page.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/" variant="primary">Back to home</ButtonLink>
        <ButtonLink href="/batters">Browse batters</ButtonLink>
      </div>
    </Card>
  );
}
