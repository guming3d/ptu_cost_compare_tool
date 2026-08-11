# Azure Foundry PTU Cost Planner

A React and TypeScript calculator for comparing monthly PayGO and provisioned throughput costs. The interface is a responsive Vite single-page application with no Streamlit or Python runtime.

The bundled catalog includes Azure OpenAI, Fireworks on Microsoft Foundry, and Google models. Azure OpenAI PTUs are estimated with normalized TPM sizing, Fireworks sizing remains a manual capacity input, and each saved comparison includes a complete calculation trace.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

## Container

```bash
docker build -t ptu-cost-planner .
docker run --rm -p 8501:8501 ptu-cost-planner
```

Open `http://localhost:8501`.

## Catalog

Pricing and throughput metadata remains in `model_config.json`. The in-app catalog editor validates updates and stores them in the browser's local storage. Restoring the bundled catalog clears that local override.

The calculator is an estimate. Azure pricing can vary by geography, deployment type, currency, and commercial agreement.
