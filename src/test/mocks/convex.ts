import { vi } from "vitest";

export const mockUseQuery = vi.fn();
export const mockUseMutation = vi.fn(() => vi.fn());
export const mockUseAction = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));
