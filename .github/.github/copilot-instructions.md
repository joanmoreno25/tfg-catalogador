# tfg-catalogador Project Conventions

- **Component Structure:** Use functional components with hooks. Never use class components.
- **Directory Structure:** - `pages/`: Only for route components (page-level logic).
    - `components/`: For reusable UI elements.
    - `services/`: For API/Firebase calls.
    - `hooks/`: For custom logic/state encapsulation.
- **Forms:** Use `react-hook-form` with `yup` or `zod` for validation.
- **Styling:** Strictly use Tailwind CSS. No inline styles. Avoid arbitrary values unless absolutely necessary.
- **API/Data:** Centralize all API/Firebase calls in `src/services/`. Never call database functions directly in React components. Always return typed data or clean responses.
- **Error Handling:** - Every API call or async operation must be wrapped in `try/catch` blocks.
    - Always provide user feedback (e.g., toast notifications or error messages) on failure.
- **State Management:** Avoid prop drilling. Use Context API for global state (Auth/Theme) and local state for component-specific data.
- **Accessibility:** Ensure all interactive elements have labels (`aria-label`) and semantic HTML.