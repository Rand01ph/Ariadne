import { useEffect, useState } from "react";
import { DEFAULT_SERVER_URL, DEFAULT_CLIENT_NAME, type ConnectionStatus } from "@/constants";

interface StatusState {
  status: ConnectionStatus;
  serverUrl: string;
  clientName: string;
  tokenHint: string;  // masked: "ariadne_sk_4f8a2c...[hidden]"
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  disconnected: "Disconnected",
  error: "Auth failed — check token",
};

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connected: "#22c55e",
  connecting: "#f59e0b",
  disconnected: "#6b7280",
  error: "#ef4444",
};

export default function App() {
  const [state, setState] = useState<StatusState>({
    status: "disconnected",
    serverUrl: DEFAULT_SERVER_URL,
    clientName: DEFAULT_CLIENT_NAME,
    tokenHint: "",
  });
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
      if (response) {
        setState({
          status: response.status ?? "disconnected",
          serverUrl: response.serverUrl ?? DEFAULT_SERVER_URL,
          clientName: response.clientName ?? DEFAULT_CLIENT_NAME,
          tokenHint: response.tokenHint ?? "",
        });
        setUrlInput(response.serverUrl ?? DEFAULT_SERVER_URL);
        setNameInput(response.clientName ?? DEFAULT_CLIENT_NAME);
        // Don't pre-fill tokenInput — user must re-enter to change
      }
    });

    const interval = setInterval(() => {
      chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
        if (response) {
          setState((prev) => ({
            ...prev,
            status: response.status ?? prev.status,
            tokenHint: response.tokenHint ?? prev.tokenHint,
          }));
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSave = () => {
    setSaving(true);
    const tasks: Promise<void>[] = [];

    if (urlInput !== state.serverUrl) {
      tasks.push(
        new Promise((res) =>
          chrome.runtime.sendMessage({ type: "SET_SERVER_URL", url: urlInput }, () => res())
        )
      );
    }
    if (nameInput !== state.clientName) {
      tasks.push(
        new Promise((res) =>
          chrome.runtime.sendMessage({ type: "SET_CLIENT_NAME", name: nameInput }, () => res())
        )
      );
    }
    if (tokenInput) {
      tasks.push(
        new Promise((res) =>
          chrome.runtime.sendMessage({ type: "SET_TOKEN", token: tokenInput }, () => res())
        )
      );
    }

    Promise.all(tasks).then(() => {
      setState((prev) => ({
        ...prev,
        serverUrl: urlInput,
        clientName: nameInput,
      }));
      setTokenInput("");
      setSaving(false);
    });
  };

  const isDirty =
    urlInput !== state.serverUrl ||
    nameInput !== state.clientName ||
    tokenInput !== "";

  const color = STATUS_COLORS[state.status];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ ...styles.dot, backgroundColor: color }} />
        <span style={styles.title}>Ariadne</span>
      </div>

      <div style={styles.statusRow}>
        <span style={{ color, fontWeight: 600 }}>
          {STATUS_LABELS[state.status]}
        </span>
        {state.status === "connected" && (
          <span style={styles.hint}>{state.clientName}</span>
        )}
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Browser Name</label>
        <input
          style={styles.input}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
          placeholder="my-browser"
        />
        <p style={styles.hint}>
          API: <code>POST /v1/cmd/<b>{nameInput || "my-browser"}</b></code>
        </p>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Server URL</label>
        <input
          style={styles.input}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="ws://localhost:8000"
        />
      </div>

      <div style={styles.section}>
        <label style={styles.label}>API Token</label>
        <input
          style={styles.input}
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder={state.tokenHint || "Paste token from server startup log"}
        />
        {state.tokenHint && (
          <p style={styles.hint}>Current: {state.tokenHint}</p>
        )}
      </div>

      <button
        style={{ ...styles.button, opacity: !isDirty || saving ? 0.5 : 1 }}
        onClick={handleSave}
        disabled={saving || !isDirty}
      >
        {saving ? "Saving..." : "Apply & Reconnect"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 320,
    padding: "16px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: 14,
    color: "#111",
    backgroundColor: "#fff",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.5px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    padding: "8px 12px",
    backgroundColor: "#f9fafb",
    borderRadius: 6,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    padding: "6px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "monospace",
    outline: "none",
  },
  hint: {
    fontSize: 11,
    color: "#6b7280",
    margin: 0,
  },
  button: {
    width: "100%",
    padding: "8px 14px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
