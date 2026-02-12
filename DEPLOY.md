# Deploy na Vercel

## Model 3D (lawendamodel.stl)

Plik ma ~497 MB. Vercel pobiera go przez proxy z GitHub Releases.

### Kroki:

1. **Utwórz Release w GitHub** (jeśli jeszcze nie istnieje):
   - Repo → Releases → Create new release
   - Tag: `v1.0`
   - Załącz plik `lawendamodel.stl` z lokalnego projektu

2. **Deploy na Vercel** – projekt jest gotowy (rewrite w `vercel.json`).

3. **Plan Vercel** – plik 497 MB wymaga:
   - **Pro plan** (limit 1 GB, timeout 300s) – zalecane
   - Na Hobby (100 MB) proxy może przekroczyć timeout 10s

### Opcjonalnie: Git LFS (jeśli masz Pro)

- Vercel Dashboard → Twoj projekt → Settings → Git → włącz **Git LFS**
- Po włączeniu zrób redeploy  
- Wtedy plik będzie serwowany jako statyczny (bez proxy).
