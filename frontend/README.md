# Frontend Development

The Vacal frontend now runs on the [Vite](https://vitejs.dev) toolchain for a faster dev server and leaner production builds.

## Available Scripts

- `npm run dev` (alias `npm start`) – Launch the Vite development server on http://localhost:5173 with hot module replacement.
- `npm run build` – Create an optimized production bundle in the `dist` directory.
- `npm run preview` – Serve the contents of `dist` locally to verify a production build.
- `npm test` – Execute the unit test suite with [Vitest](https://vitest.dev) in watch mode.

## Environment Variables

Vite exposes only variables prefixed with `VITE_`. Configure the API endpoint by setting `VITE_API_URL` (see `.env.example`).

## Static Assets

Files placed in the `public` directory are copied as-is to the build output. The application entry point is defined in `index.html` at the project root and loads `src/main.jsx`.
