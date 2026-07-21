"use client";

import { useEffect, useState } from "react";
import { subscribeToCollection } from "./db";
import { filterByPlanta } from "./auth";
import type { QueryConstraint } from "firebase/firestore";

/**
 * Hook de tiempo real: suscribe a una colección de Firestore con onSnapshot.
 * Aplica filterByPlanta automáticamente y actualiza el estado en cada cambio,
 * sin necesidad de hacer refresh manual.
 *
 * Uso:
 *   const cargas = useCollection<CargaDiesel>(COLLECTIONS.diesel);
 *
 * Reemplaza el patrón:
 *   useEffect(() => {
 *     getCollectionDocs<T>(col).then(d => setState(filterByPlanta(d)));
 *   }, []);
 */
export function useCollection<T extends { planta?: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const unsub = subscribeToCollection<T>(
      collectionName,
      (docs) => setData(filterByPlanta(docs)),
      constraints,
    );
    return unsub;
  // constraints array identity changes on every render — pass it memoized from the caller if needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return data;
}

/**
 * Variante sin filtro de planta — para colecciones globales como users, clientes.
 */
export function useCollectionRaw<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const unsub = subscribeToCollection<T>(
      collectionName,
      setData,
      constraints,
    );
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return data;
}
