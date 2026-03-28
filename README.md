# Carré ou Cercle ?

Application web qui détermine si votre visage est plutôt rond ou carré, en calculant la similarité entre une forme géométrique et le contour de votre visage.

## Fonctionnement

1. **Capture webcam** — L'application accède à votre caméra et vous permet de prendre une photo.
2. **Détection du visage** — 68 points de repère (landmarks) sont détectés sur le visage via [face-api.js](https://github.com/justadudewhohacks/face-api.js), et l'enveloppe convexe du visage est calculée.
3. **Dessin interactif** — Placez un cercle ou un rectangle sur votre visage. La forme est déplaçable et redimensionnable grâce à des poignées.
4. **Score de similarité** — Un score IoU (Intersection over Union) est calculé en temps réel entre la forme dessinée et l'enveloppe convexe du visage.
5. **Meilleur ajustement** — Un bouton calcule automatiquement le cercle et le rectangle optimaux, ceux qui maximisent le score de similarité.

## Lancement

```bash
python3 -m http.server 8000
```

Puis ouvrir [http://localhost:8000](http://localhost:8000) dans un navigateur.

> Un serveur local est nécessaire car l'accès à la webcam requiert un contexte sécurisé.

## Stack technique

- **Vanilla HTML/CSS/JS** — Aucun framework, aucune étape de build
- **[face-api.js](https://github.com/justadudewhohacks/face-api.js)** v0.22.2 (via CDN) — Détection de visage et landmarks
- **Canvas API** — Rendu graphique et interactions

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Page principale, CSS, inclusion des scripts |
| `app.js` | Webcam, chargement des modèles, détection, orchestration UI |
| `geometry.js` | Enveloppe convexe, point-in-polygon, clipping Sutherland-Hodgman |
| `scoring.js` | Score IoU, calcul du meilleur cercle et rectangle |
| `shapes.js` | Création, rendu, drag & drop, redimensionnement des formes |

## Algorithmes

- **Enveloppe convexe** — Andrew's monotone chain sur les 68 landmarks
- **IoU rectangle** — Clipping Sutherland-Hodgman (intersection exacte polygone/rectangle) + formule du lacet
- **IoU cercle** — Échantillonnage spatial (~10K points) pour approximer l'intersection cercle/polygone
- **Best-fit cercle** — Centroïde des landmarks + optimisation du rayon par balayage
- **Best-fit rectangle** — Bounding box de l'enveloppe convexe + rétrécissement itératif

## Licence

MIT — voir [LICENSE](LICENSE).
