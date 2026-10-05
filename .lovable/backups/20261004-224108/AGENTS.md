<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Use the generated authentication client only for identity and sessions; all application data must pass through the centralized REST client because the product backend is an external Fastify API.
- Keep monetary API values as decimal strings and format them without numeric arithmetic to preserve precision.
- Organize product code by feature and use TanStack Router's file-based routes because this repository is a TanStack Start application.
- Transaction list state is URL-independent TanStack Query state backed by the REST contract; optimistic row edits must snapshot and roll back every cached transaction page.
