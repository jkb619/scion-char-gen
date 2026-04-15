Split game tables (one logical name per folder)

Each folder ``src/data/tables/<tableName>/`` holds one or more ``*.json`` files.
They are merged in **sorted filename order** when the server builds the bundle:

  - ``knacks`` — Pandora’s Box / Origin core, then Saints & Monsters, then Titans Rising
  - ``purviews`` — Pandora’s Box core, Saints denizens/Magic, MotM Awareness innates, standard innate blurbs
  - ``boons`` — Pandora’s Box catalog, then Saints & Monsters hooks
  - ``callings`` — Origin core Callings, then MotM / Saints extended Callings

Primary PB-facing files (targets for ladder/boon sync scripts) are named in
``app/services/data_tables.py`` as ``PRIMARY_FRAGMENT``.

If a folder is **missing** or empty for a table name, the loader falls back to
``src/data/<tableName>.json`` when that legacy file exists.
