"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  agentProjectKey,
  agentWebSocketUrl,
  buildAgentWebSocketUrl,
} from "../../../lib/agentClient";

export type AgentSocketStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface AgentSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface UseAgentSocketOptions {
  sessionId: string;
  userId: string;
  projectId: string;
  enabled?: boolean;
  onMessage?: (payload: AgentSocketMessage) => void;
}

const MAX_RECONNECT = 12;

export function useAgentSocket({
  sessionId,
  userId,
  projectId,
  enabled = true,
  onMessage,
}: UseAgentSocketOptions) {
  const [status, setStatus] = useState<AgentSocketStatus>("disconnected");
  const [generating, setGenerating] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const userClosedRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const dispatch = useCallback((payload: AgentSocketMessage) => {
    if (payload.type === "ack") {
      setGenerating(true);
    }
    if (
      payload.type === "response" ||
      payload.type === "run_complete" ||
      payload.type === "stopped" ||
      payload.type === "run_error"
    ) {
      setGenerating(false);
    }
    onMessageRef.current?.(payload);
  }, []);

  const connect = useCallback(
    (isAuto = false) => {
      if (!enabled || userClosedRef.current) {
        return;
      }
      clearReconnectTimer();

      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          /* ignore */
        }
        socketRef.current = null;
      }

      setStatus(isAuto ? "reconnecting" : "connecting");

      const url = buildAgentWebSocketUrl({
        sessionId,
        userId,
        projectId: agentProjectKey(projectId),
      });

      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        setStatus("disconnected");
        scheduleReconnect();
        return;
      }

      socketRef.current = socket;

      socket.addEventListener("open", () => {
        reconnectAttemptsRef.current = 0;
        setStatus("connected");
        socket.send(
          JSON.stringify({
            type: "list_files",
            session_id: sessionId,
            user_id: userId,
            project_id: agentProjectKey(projectId),
          }),
        );
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as AgentSocketMessage;
          dispatch(payload);
        } catch {
          dispatch({ type: "raw", content: event.data });
        }
      });

      socket.addEventListener("close", () => {
        socketRef.current = null;
        setGenerating(false);
        if (!userClosedRef.current) {
          setStatus("reconnecting");
          scheduleReconnect();
        } else {
          setStatus("disconnected");
        }
      });

      socket.addEventListener("error", () => {
        setGenerating(false);
        if (!userClosedRef.current && socket.readyState !== WebSocket.OPEN) {
          setStatus("reconnecting");
          scheduleReconnect();
        }
      });

      function scheduleReconnect() {
        if (userClosedRef.current || reconnectTimerRef.current) {
          return;
        }
        if (reconnectAttemptsRef.current >= MAX_RECONNECT) {
          setStatus("disconnected");
          dispatch({
            type: "socket_give_up",
            message: "Could not reconnect. Click Reconnect or refresh the page.",
          });
          return;
        }
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttemptsRef.current);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect(true);
        }, delay);
        dispatch({
          type: "socket_reconnecting",
          attempt: reconnectAttemptsRef.current,
          delay_seconds: Math.round(delay / 1000),
        });
      }
    },
    [clearReconnectTimer, dispatch, enabled, projectId, sessionId, userId],
  );

  const disconnect = useCallback(() => {
    userClosedRef.current = true;
    clearReconnectTimer();
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        /* ignore */
      }
      socketRef.current = null;
    }
    setStatus("disconnected");
    setGenerating(false);
  }, [clearReconnectTimer]);

  const reconnect = useCallback(() => {
    userClosedRef.current = false;
    reconnectAttemptsRef.current = 0;
    connect(false);
  }, [connect]);

  const send = useCallback(
    (payload: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
      }
      socket.send(JSON.stringify(payload));
      return true;
    },
    [],
  );

  const sendPrompt = useCallback(
    (prompt: string) => {
      const ok = send({
        type: "message",
        prompt,
        session_id: sessionId,
        user_id: userId,
        project_id: agentProjectKey(projectId),
      });
      if (ok) {
        setGenerating(true);
      }
      return ok;
    },
    [projectId, send, sessionId, userId],
  );

  const stopGeneration = useCallback(() => {
    send({
      type: "stop",
      session_id: sessionId,
      user_id: userId,
      project_id: agentProjectKey(projectId),
    });
  }, [projectId, send, sessionId, userId]);

  const buildPreview = useCallback(
    (force = true) => {
      send({
        type: "build_preview",
        session_id: sessionId,
        user_id: userId,
        project_id: agentProjectKey(projectId),
        force,
      });
    },
    [projectId, send, sessionId, userId],
  );

  useEffect(() => {
    userClosedRef.current = false;
    reconnectAttemptsRef.current = 0;
    if (enabled) {
      connect(false);
    }
    return () => {
      userClosedRef.current = true;
      clearReconnectTimer();
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [enabled, sessionId, userId, projectId, connect, clearReconnectTimer]);

  return {
    status,
    generating,
    connected: status === "connected",
    connect: reconnect,
    disconnect,
    send,
    sendPrompt,
    stopGeneration,
    buildPreview,
    wsUrl: agentWebSocketUrl(),
  };
}
