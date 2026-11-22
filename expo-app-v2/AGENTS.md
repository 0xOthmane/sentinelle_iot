This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Error Handling & Observability

- Never let an error fail silently. Every error you catch must be handled and reported to Sentry.
- Report with `Sentry.captureException(error, { tags, extra })` from `@sentry/react-native`. Include enough context to debug: feature, operation, and route/endpoint.
- Stream structured logs through `Sentry.logger` (`info` / `warn` / `error`) so they land in Sentry next to the error. Sentry Logs is already enabled in `src/app/_layout.tsx` — do not replace it with `console.log` for anything that matters.
- Wrap async work (API calls, storage, native modules) in `try/catch`, report in the `catch`, then degrade gracefully with user-facing feedback.
- Keep user-facing messages generic; never surface raw error objects or stack traces in the UI.
- Never attach secrets, tokens, or full request bodies to Sentry events.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## React Dependencies

- Use Zod (`zod`) for runtime validation and type-safe schemas.
- Use React Hook Form (`react-hook-form`) with `@hookform/resolvers` (`zodResolver`) for every form. Define each form's schema with Zod and keep validation rules there, not inline in handlers or components.
- The React Compiler (enabled in `app.json`) is not compatible with React Hook Form's mutable API yet. Add `'use no memo';` at the top of components that use `Controller`, `watch`, `getValues`, `reset`, or `useFieldArray`.
- Use Zustand (`zustand`) for shared application state. Keep component-local state in React state unless state truly needs to be shared.
- Before adding or changing a React effect, read https://react.dev/learn/you-might-not-need-an-effect and check whether the behavior can be expressed with event handlers, derived values, or another React-native pattern instead.
