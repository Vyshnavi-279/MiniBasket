import { useMemo } from "react";
import axios from "axios";
import { useAuth } from "@clerk/react";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const publicApi = axios.create({ baseURL: API });

export function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => {
    const instance = axios.create({ baseURL: API });
    instance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, [getToken]);
}

export async function streamSSE(path, body, token, onEvent) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.";
    try {
      const data = await res.json();
      if (typeof data.detail === "string") msg = data.detail;
    } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data:")) onEvent(JSON.parse(line.slice(5).trim()));
    }
  }
}

export function errMsg(e, fallback = "Something went wrong. Please try again.") {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg?.replace(/^Value error, /, "")).join(", ");
  return e?.message || fallback;
}
