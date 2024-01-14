# Yee

TypeScript server for controlling Yeelight devices

```
Usage:
        npm run cli <command> [options...]

Commands:
        start           Starts yee server.
        status          Displays yee server status.
        scan            Scans local network for bulbs.
        connect <bulb>          Connect to a light bulb.
        disconnect <bulb>               Disconnect from a light bulb.
        on <bulb>               Turn on a light bulb.
        off <bulb>              Turn off a light bulb.
        setName <bulb> <name>           Set light bulb name.

Options:
        --help          Displays this message.
        --host  -h      Specifies host address to use. Can include port. Default '127.0.0.1'
        --port  -p      Specifies port to use. Default '3900'

<bulb> can be bulb name, id or location (eg: "yeelight://192.168.12.34:55443")
```

### Run development

```bash
npm run start
```
