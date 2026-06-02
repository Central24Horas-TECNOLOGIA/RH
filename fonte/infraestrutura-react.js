import React, {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';

// Centraliza a infraestrutura React para manter imports curtos e consistentes.
const criarElementoReact = Object.assign(
  (tipo, propriedades, ...filhos) =>
    React.createElement(tipo, propriedades, ...filhos),
  {
    Fragment: React.Fragment,
  },
);
const html = htm.bind(criarElementoReact);

export {
  React,
  lazy,
  Suspense,
  createContext,
  createRoot,
  html,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
};
