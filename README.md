# plane-tracker

Stack Docker per ricevitore ADS-B con interfaccia radar React, basato su [docker-adsb-ultrafeeder](https://github.com/sdr-enthusiasts/docker-adsb-ultrafeeder).

Richiede una chiavetta **RTL-SDR** collegata all'host.

## Porte esposte

| Porta | Servizio |
|-------|----------|
| `UI_PORT` (default `8090`) | Radar React |
| 30003 | SBS output |
| 30104 | Beast input |

## Deploy su Portainer

### 1. Crea lo stack

In Portainer → **Stacks** → **Add stack** → scegli **Repository**.

- Repository URL: `https://github.com/Sebaf-26/plane-tracker`
- Branch: `main`
- Compose path: `docker-compose.yml`

### 2. Variabili d'ambiente

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `READSB_LAT` | Latitudine del receiver | `43.929663` |
| `READSB_LON` | Longitudine del receiver | `10.203978` |
| `READSB_ALT` | Altitudine del receiver | `50m` |
| `UI_PORT` | Porta per il radar React (opzionale, default `8090`) | `8090` |
| `TZ` | Timezone (opzionale, default `Europe/Rome`) | `Europe/Rome` |
| `READSB_GAIN` | Guadagno SDR (opzionale, default `autogain`) | `autogain` |

> Le coordinate non devono stare nel repo: inseriscile **solo** come env in Portainer.

### 3. Deploy

Clicca **Deploy the stack**. Il frontend si builda al primo avvio (~2 min), poi l'interfaccia radar è su `http://<ip-host>:<UI_PORT>`.

## Accesso dispositivo USB

La regola `device_cgroup_rules: c 189:* rwm` è già inclusa nel compose. Assicurati che il device `/dev/bus/usb` sia passato all'LXC da Proxmox.
