"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToCollection } from "./db";
import { filterByPlanta } from "./auth";
import type { QueryConstraint } from "firebase/firestore";

export function useCollection<T extends { planta?: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): T[] {
  const [data, setData] = useState<T[]>([]);
  const rawRef = useRef<T[]>([]);

  useEffect(() => {
    const unsub = subscribeToCollection<T>(
      collectionName,
      (docs) => { rawRef.current = docs; setData(filterByPlanta(docs)); },
      constraints,
    );
    const refilter = () => setData(filterByPlanta(rawRef.current));
    window.addEventListener("duro:session-updated", refilter);
    return () => { unsub(); window.removeEventListener("duro:session-updated", refilter); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return data;
}

export function useCollectionWithLoading<T extends { planta?: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const rawRef = useRef<T[]>([]);

  useEffect(() => {
    const unsub = subscribeToCollection<T>(
      collectionName,
      (docs) => { rawRef.current = docs; setData(filterByPlanta(docs)); setLoading(false); },
      constraints,
    );
    const refilter = () => setData(filterByPlanta(rawRef.current));
    window.addEventListener("duro:session-updated", refilter);
    return () => { unsub(); window.removeEventListener("duro:session-updated", refilter); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return { data, loading };
}

/** Variante sin filtro de planta — para colecciones globales como users, clientes. */
export function useCollectionRaw<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const unsub = subscribeToCollection<T>(collectionName, setData, constraints);
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return data;
}

/** Igual que useCollectionRaw pero devuelve { data, loading } sin filtro de planta. */
export function useCollectionRawWithLoading<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCollection<T>(
      collectionName,
      (docs) => { setData(docs); setLoading(false); },
      constraints,
    );
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return { data, loading };
}
