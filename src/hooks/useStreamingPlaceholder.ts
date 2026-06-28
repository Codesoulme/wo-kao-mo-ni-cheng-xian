import { useEffect, useRef, useState } from 'react';

/**
 * 流式叙事占位事件 ID 状态管理。
 * 之前用 `(useGameStore.getState() as any)._placeholderId` 这种把 React-local 状态
 * 写到全局 store 的 hack 会让 React 完全看不到，破坏渲染一致性。
 * 这个 hook 把 placeholderId 收敛在 ActionButtons 组件的 useState + useRef 里：
 * - `placeholderId` 用于触发重渲染
 * - `placeholderIdRef` 用于在异步/事件循环里同步读取最新值
 * - `setPlaceholder` 同时更新两者
 */
export function useStreamingPlaceholder() {
  const [placeholderId, setPlaceholderId] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);

  const setPlaceholder = (id: string | null) => {
    idRef.current = id;
    setPlaceholderId(id);
  };

  // 卸载时清空 ref 指向，避免意外持有陈旧 id
  useEffect(() => {
    return () => {
      idRef.current = null;
    };
  }, []);

  return { placeholderId, setPlaceholder, placeholderIdRef: idRef };
}
