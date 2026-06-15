# plane-tracker

Stack Docker per ricevitore ADS-B basato su [docker-adsb-ultrafeeder](https://github.com/sdr-enthusiasts/docker-adsb-ultrafeeder), pensato per il deploy su **Portainer** tramite Git stack.

Richiede una chiavetta **RTL-SDR** collegata all'host.

## Porte esposte

| Porta | Servizio |
|-------|----------|
| 8080  | Interfaccia web tar1090 (radar) |
| 30003 | SBS output |
| 30104 | Beast input |

## Deploy su Portainer

### 1. Crea lo stack

In Portainer → **Stacks** → **Add stack** → scegli **Repository**.

- Repository URL: `https://github.com/Sebaf-26/plane-tracker`
- Branch: `main`
- Compose path: `docker-compose.yml`

### 2. Configura le variabili d'ambiente

Nella sezione **Environment variables** di Portainer aggiungi:

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `READSB_LAT` | Latitudine del receiver | `45.4642` |
| `READSB_LON` | Longitudine del receiver | `9.1900` |
| `READSB_ALT` | Altitudine del receiver | `120m` |
| `TZ` | Timezone (opzionale, default `Europe/Rome`) | `Europe/Rome` |
| `READSB_GAIN` | Guadagno SDR (opzionale, default `autogain`) | `autogain` |

> Le coordinate non devono stare nel repo: inseriscile **solo** come env in Portainer.

### 3. Deploy

Clicca **Deploy the stack**. L'interfaccia radar sarà disponibile su `http://<ip-host>:8080`.

## Accesso dispositivo USB

Ultrafeeder deve poter accedere alla chiavetta RTL-SDR. La regola `device_cgroup_rules: c 189:* rwm` è già inclusa nel compose. Assicurati che Portainer/Docker giri su un host con la chiavetta collegata.
