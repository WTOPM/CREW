# Electron — команды

В **PowerShell** используйте `npm.cmd` (обычный `npm` может блокироваться политикой скриптов).  
В **cmd** достаточно `npm`.

## Разработка (горячая перезагрузка)

```powershell
npm.cmd run electron:dev
```

Запускает Angular на `http://localhost:4200` и открывает окно Electron.  
Данные в режиме разработки пишутся в папку `data\` в корне проекта.

## Сборка portable exe

```powershell
npm.cmd run electron:build
```

Готовый файл:

```
CREW-App\CREW-Documents.exe
```

Exe собирается **пустым** (без crew/voyage данных). Папку `data\` при обновлении не трогать.
