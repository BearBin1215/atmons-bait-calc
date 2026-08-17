<h1 align="center">All the Mons Bait Calculator</h1>

<p align="center">
  <a href="https://react.dev" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/React-v19-20232a?style=flat-square&logo=react&logoColor=61dafb" alt="React" /></a>
  <a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/shadcn%2Fui-v4-000000?style=flat-square&logo=shadcnui&logoColor=white" alt="shadcn/ui" /></a>
  <a href="https://vite.dev" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/Vite-v8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://www.typescriptlang.org" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/TypeScript-v6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://docs.github.com/actions" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white" alt="GitHub Actions" /></a>
</p>

## About

Calculates how Poké Snacks made from different berry / material combinations in the [All the Mons](https://github.com/AllTheMods/All-the-Mons) modpack affect Pokémon spawn probabilities in a given scenario (biome, light, weather, spawn position). The calculation logic is replicated from the [Cobblemon](https://gitlab.com/cable-mc/cobblemon) mod source code.

Live site: <https://bearbin1215.github.io/atmons-bait-calc/>

## License

- The code in this repository is released under the [MIT License](LICENSE)
- The site icon `public/poke_snack.png` is sourced from the [Cobblemon](https://gitlab.com/cable-mc/cobblemon) mod and is licensed under [MPL-2.0](https://mozilla.org/MPL/2.0/), copyright by the Cobblemon contributors. See [public/ICON_LICENSE.txt](public/ICON_LICENSE.txt)
- The static data under `public/data/` is generated from data files of Cobblemon (MPL-2.0) and the All the Mons datapack; the algorithm in `src/lib/calc.ts` is ported from the Cobblemon source code
- Pokémon names, types and related content are copyrighted by Nintendo / The Pokémon Company. This tool is an unofficial fan project
