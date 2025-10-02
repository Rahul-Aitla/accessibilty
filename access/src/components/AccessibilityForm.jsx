import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  AlertCircle,
  Globe,
  Loader2,
  Award,
  Trophy,
  Medal,
} from "lucide-react";
import AuditOptions from "./AuditOptions";

export default function AccessibilityForm({ onScan, loading }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [selectedAudits, setSelectedAudits] = useState(["accessibility"]);
  const [brandColors, setBrandColors] = useState("");
  const [websiteStatus, setWebsiteStatus] = useState(null);
  const [checkingWebsite, setCheckingWebsite] = useState(false);
  const [scanCount, setScanCount] = useState(() => {
    return parseInt(localStorage.getItem("scanCount") || "0");
  });

  // Clear error and website status when URL changes
  useEffect(() => {
    if (error && url) {
      setError("");
    }
    if (websiteStatus && url !== websiteStatus.url) {
      setWebsiteStatus(null);
    }
  }, [url, error, websiteStatus]);

  const checkWebsiteAvailability = async () => {
    if (!url?.trim()) {
      toast.error("Please enter a URL first");
      return;
    }

    const normalizedUrl = normalizeUrl(url);
    if (!validateUrl(normalizedUrl)) {
      toast.error("Please enter a valid URL");
      return;
    }

    setCheckingWebsite(true);
    setWebsiteStatus(null);

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    console.log("Using API URL:", apiUrl);

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      // First, test basic server connectivity with timeout
      console.log("Testing server connectivity...");
      const healthResponse = await fetch(`${apiUrl}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }).catch((error) => {
        if (error.name === "AbortError") {
          throw new Error("Server connection timed out");
        }
        throw error;
      });

      if (!healthResponse.ok) {
        throw new Error(`Server not responding: ${healthResponse.status}`);
      }

      const healthData = await healthResponse.json();
      console.log("Server health check passed:", healthData.status);

      // Now try the website check endpoint with retry logic
      console.log("Checking website availability:", normalizedUrl);
      const checkEndpoint = `${apiUrl}/api/check-website`;

      let retries = 2;
      let response;

      while (retries >= 0) {
        try {
          response = await fetch(checkEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: normalizedUrl }),
            signal: controller.signal,
          });
          break; // If successful, exit the retry loop
        } catch (fetchError) {
          if (retries === 0 || fetchError.name === "AbortError") {
            throw fetchError; // No more retries or timeout occurred
          }
          console.log(`Retrying website check (${retries} attempts left)...`);
          retries--;
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }

      console.log("Website check response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);

        // Try to parse as JSON in case it's a structured error
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(
            errorJson.error ||
              errorJson.message ||
              `Request failed: ${response.status}`
          );
        } catch (parseError) {
          throw new Error(
            `API request failed: ${response.status} - ${errorText.substring(
              0,
              100
            )}`
          );
        }
      }

      const result = await response.json();
      console.log("Website check result:", result);

      // Validate result structure to prevent UI errors
      const validatedResult = {
        accessible: Boolean(result.accessible),
        error: result.error || null,
        recommendation:
          result.recommendation || "Website is ready for scanning",
        details: result.details || null,
        loadTime: result.loadTime || null,
      };

      setWebsiteStatus(validatedResult);

      if (validatedResult.accessible) {
        toast.success("Website is accessible and ready for scanning!");
      } else {
        toast.warning(
          `Website issue: ${
            validatedResult.error || validatedResult.recommendation
          }`
        );
      }
    } catch (error) {
      console.error("Website check failed:", error);

      // More specific error handling
      let errorMessage = "Failed to check website availability";
      let recommendation = "Try scanning directly or check the issues below";

      if (error.name === "AbortError" || error.message.includes("timed out")) {
        errorMessage = "Website check timed out";
        recommendation =
          "The server took too long to respond. Try scanning directly.";
      } else if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        errorMessage = "Cannot connect to backend server";
        recommendation = `Make sure the backend server is running on ${apiUrl}`;
      } else if (error.message.includes("Server not responding")) {
        errorMessage = "Backend server is not responding";
        recommendation =
          "The server may be starting up or down. Try again in a moment.";
      } else if (
        error.message.includes("404") ||
        error.message.includes("not found")
      ) {
        errorMessage = "Website check feature not available";
        recommendation =
          "This feature may not be supported. Try scanning directly.";
      } else if (error.message.includes("500")) {
        errorMessage = "Server internal error";
        recommendation = "Check server logs for details.";
      } else {
        errorMessage = error.message || "Unknown error occurred";
      }

      toast.error(errorMessage);
      setWebsiteStatus({
        accessible: false,
        error: errorMessage,
        recommendation: recommendation,
        debug: import.meta.env.DEV
          ? {
              originalError: error.message,
              apiUrl: apiUrl,
              timestamp: new Date().toISOString(),
            }
          : undefined,
      });
    } finally {
      clearTimeout(timeoutId);
      setCheckingWebsite(false);
    }
  };

  const validateUrl = (value) => {
    if (!value?.trim()) return false;

    try {
      const u = new URL(value.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const normalizeUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    // Add https:// if no protocol specified
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return "https://" + trimmed;
    }
    return trimmed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) {
      return; // Prevent double submission
    }

    const normalizedUrl = normalizeUrl(url);

    if (!validateUrl(normalizedUrl)) {
      const errorMsg = "Please enter a valid URL (e.g., https://example.com)";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setError("");
    setUrl(normalizedUrl); // Update the input with normalized URL

    const brandColorsArr = selectedAudits.includes("brand-color-contrast")
      ? brandColors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

    // Update scan count and show achievement if milestone reached
    const newCount = scanCount + 1;
    setScanCount(newCount);
    localStorage.setItem("scanCount", newCount.toString());

    if (newCount === 5) {
      toast.success("🏆 Achievement Unlocked: Accessibility Explorer!", {
        icon: <Trophy className="h-5 w-5" />,
      });
    } else if (newCount === 10) {
      toast.success("🥇 Achievement Unlocked: Accessibility Champion!", {
        icon: <Award className="h-5 w-5" />,
      });
    } else if (newCount === 25) {
      toast.success("🏅 Achievement Unlocked: Accessibility Master!", {
        icon: <Medal className="h-5 w-5" />,
      });
    }

    try {
      await onScan(normalizedUrl, selectedAudits, brandColorsArr);
    } catch (error) {
      console.error("Scan failed:", error);
      toast.error("Failed to start scan. Please try again.");
    }
  };

  const handleUrlChange = (e) => {
    const value = e.target.value;
    setUrl(value);

    // Real-time validation feedback
    if (value.trim() && !validateUrl(normalizeUrl(value))) {
      setError("Invalid URL format");
    } else {
      setError("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 flex flex-col gap-6 mb-8 animate-fade-in"
      aria-label="Website URL Form"
      role="search"
    >
      <h2 className="text-3xl font-extrabold text-center mb-2 text-primary drop-shadow">
        Website Analysis
      </h2>
      <p className="text-center text-gray-500 dark:text-gray-300 mb-4 text-base">
        Enter the URL of the website you want to analyze for accessibility
        issues.
      </p>

      {/* User level badge based on scan count */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium">
          {scanCount < 5 ? (
            <span className="bg-amber-700 text-white px-2 py-1 rounded-full flex items-center gap-1">
              <Trophy className="h-4 w-4" /> Bronze Scanner
            </span>
          ) : scanCount < 15 ? (
            <span className="bg-slate-400 text-white px-2 py-1 rounded-full flex items-center gap-1">
              <Award className="h-4 w-4" /> Silver Scanner
            </span>
          ) : scanCount < 30 ? (
            <span className="bg-yellow-500 text-white px-2 py-1 rounded-full flex items-center gap-1">
              <Medal className="h-4 w-4" /> Gold Scanner
            </span>
          ) : (
            <span className="bg-teal-500 text-white px-2 py-1 rounded-full flex items-center gap-1">
              <Medal className="h-4 w-4" /> Platinum Expert
            </span>
          )}
          <span className="ml-2 text-xs opacity-75">({scanCount} scans)</span>
        </div>
      </div>

      {/* Progress to next level */}
      <div className="mb-4">
        <div className="text-xs text-center mb-1">
          {scanCount < 5
            ? `${scanCount}/5 to Silver`
            : scanCount < 15
            ? `${scanCount}/15 to Gold`
            : scanCount < 30
            ? `${scanCount}/30 to Platinum`
            : `${scanCount} scans - Max level reached!`}
        </div>
        <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${
                scanCount < 5
                  ? (scanCount / 5) * 100
                  : scanCount < 15
                  ? (scanCount / 15) * 100
                  : scanCount < 30
                  ? (scanCount / 30) * 100
                  : 100
              }%`,
              backgroundColor:
                scanCount < 5
                  ? "#b45309"
                  : scanCount < 15
                  ? "#94a3b8"
                  : scanCount < 30
                  ? "#eab308"
                  : "#14b8a6",
            }}
          ></div>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row items-center gap-2 w-full">
          <span className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-l-lg text-gray-500 text-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 21a4 4 0 01-5.656 0l-5.657-5.657a4 4 0 010-5.656l8.485-8.485a4 4 0 015.657 0l5.656 5.657a4 4 0 010 5.656l-1.414 1.414"
              />
            </svg>
          </span>
          <input
            id="website-url"
            type="url"
            className={`flex-1 px-5 py-3 rounded-r-lg border-t border-b border-r focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-900 text-black dark:text-white text-lg shadow-sm transition-colors ${
              error
                ? "border-red-500 dark:border-red-400"
                : "border-gray-300 dark:border-gray-700"
            }`}
            placeholder="https://example.com"
            value={url}
            onChange={handleUrlChange}
            onBlur={() => {
              if (url.trim()) {
                setUrl(normalizeUrl(url));
              }
            }}
            aria-label="Website URL"
            aria-invalid={!!error}
            aria-describedby={error ? "url-error" : undefined}
            required
            autoComplete="url"
            autoFocus
          />
          <button
            type="button"
            onClick={checkWebsiteAvailability}
            className="ml-2 px-4 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm shadow transition focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-2 disabled:opacity-60"
            disabled={checkingWebsite || loading}
            aria-label="Check website availability"
            title="Quick check if website is accessible"
          >
            {checkingWebsite ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            Check
          </button>
          <button
            type="submit"
            className="ml-2 px-8 py-3 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-lg shadow transition focus:outline-none focus:ring-2 focus:ring-yellow-400 flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-60"
            disabled={loading}
            aria-busy={loading}
            aria-label="Analyze website"
          >
            {loading ? (
              <svg
                className="animate-spin h-5 w-5 mr-2 text-black"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                ></path>
              </svg>
            ) : (
              <span>Analyze</span>
            )}
          </button>
        </div>
        {error && (
          <span
            id="url-error"
            className="text-red-600 dark:text-red-400 text-sm mt-1 ml-2 flex items-center gap-1"
            role="alert"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </span>
        )}

        {websiteStatus && (
          <div
            className={`mt-2 p-3 rounded-lg border text-sm ${
              websiteStatus.accessible
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {websiteStatus.accessible ? (
                <CheckCircle className="h-5 w-5 mt-0.5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 mt-0.5 text-orange-600 dark:text-orange-400" />
              )}
              <div className="flex-1">
                <div className="font-medium">
                  {websiteStatus.accessible
                    ? "Website Available"
                    : "Website Issue Detected"}
                </div>
                <div className="mt-1 text-xs">
                  {websiteStatus.recommendation}
                </div>
                {websiteStatus.details && (
                  <div className="mt-1 text-xs opacity-75">
                    {websiteStatus.details.title &&
                      `Title: "${websiteStatus.details.title}"`}
                    {websiteStatus.loadTime &&
                      ` • Load time: ${websiteStatus.loadTime}ms`}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="w-full">
        <AuditOptions
          selected={selectedAudits}
          setSelected={setSelectedAudits}
          brandColors={brandColors}
          setBrandColors={setBrandColors}
        />
      </div>
    </form>
  );
}
