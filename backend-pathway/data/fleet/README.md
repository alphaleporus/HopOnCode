# Demo fleet data

Derived from **"Delivery truck trips data"** by Ram Thiagu (Kaggle),
https://www.kaggle.com/datasets/ramakrishnanthiyagu/delivery-truck-trips-data,
licensed **CC BY-SA 3.0**. These derived files are shared under the same licence.

Built by `backend-pathway/scripts/build_fleet_dataset.py` from the original spreadsheet (not committed:
it contains driver names and phone numbers).

- `lanes.json`: 16 real South-India lanes (most frequent 60–700 km trips), road-snapped with OSRM over
  OpenStreetMap. Lanes whose coordinates disagree with the dataset's stated distance were rejected (see `stats.json`).
- `fleet.json`: demo trucks assigned to those lanes (vehicle numbers replaced by TRK-101…).
- `stats.json`: dataset statistics; 63% of the 6,880 trips were flagged delayed by the shipper.

Customer names are replaced by anonymous sector labels. Contract terms in `data/contracts/GEN-*.json` are
generated: penalty rates and cargo values are illustrative; relief prices use published ₹45–85/km rates.
