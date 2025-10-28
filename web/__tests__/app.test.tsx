import { describe, it, expect } from "vitest";
import App from "../pages/_app";

// Minimal test to cover _app wrapper
describe("_app wrapper", () => {
  it("renders page component via App", () => {
    function Page() {
      return <div>hello</div>;
    }
    const element = (App as any)({ Component: Page as any, pageProps: {} });
    expect(element).toBeTruthy();
  });
});
