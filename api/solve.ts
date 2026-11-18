import { solve } from '../server/solve.js';

export default {
  fetch(request: Request) {
    return solve(request, process.env.GEMINI_API_KEY);
  },
};
