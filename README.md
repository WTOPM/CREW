# Crew Documents

Приложение для управления данными судна и экипажа на основе `DOCUMENT.xlsx`. Локальное хранение, portable EXE для Windows.

## Запуск в браузере (разработка)

```bash
npm start
```

Откройте http://localhost:4200

## Запуск как desktop-приложение (разработка)

```bash
npm run electron:dev
```

## Сборка portable EXE

```bash
npm run electron:build
```

Готовый файл: `release/CREW-Documents.exe`

При первом запуске EXE создаёт папку `data/` рядом с исполняемым файлом и сохраняет туда `crew-data.json`. Для переноса на другой компьютер скопируйте **EXE + папку data/**.

## Функции

- **Главная** — данные судна (вкладка Input), текущий экипаж, архив
- **Crew Arr.** — форма IMO CREW LIST (FAL Form 5), генерация PDF
- **Импорт Excel** — загрузка из `DOCUMENT.xlsx`
- **Экспорт/импорт JSON** — резервное копирование данных

