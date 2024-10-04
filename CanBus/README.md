# Test de Monitoreo CANBus

# IoT CanBUS
<div align="center">
<img src="../Recursos/Imagenes/e2i_logo.png" alt="logo" height="60"></img>
</div>


About it
--- 

# Start
init with the command -> node src/app.js, one time execute this isn't show information, if you want to check the process check in other terminal -> tail -f logs/year/month/date/date.log.

# Simulate data CanBus
For simulare data CanBus, init the command -> node utils/sendCan/canSend.js

# CanBus

first we initialize the can bus port:
  
    sudo ip link set can0 up type can bitrate 250000

the existence of the can bus port is verified:

    sudo ifconfig can0

ith the following command we can sniff out the data:
    
    candump can0

the following command we save the data in .log format:
    
    candump can0 -l

para enviar data a aws se ejcuta el siguiente comando:
    
    sudo node /home/pi/iot/src/app.js


# Notes

- [Andino X1 - CanBus](https://andino.systems/extensions/can)

## Archivo de configuración: config.json

El archivo de configuración del programa almacena los siguientes parámetros:

- **"program-reading"**: Parámetros específicos para el programa de lectura y almacenamiento de datos CANBus.
    - **"canPort"**: Puerto CANBus para la adquisición de datos (can0: puerto físico, vcan0: puerto virtual).

- **"program-sending"**: Parámetros específicos para el programa de lectura y almacenamiento de datos CANBus. 

    - **"mqtt"**: Configuración para el envío de datos mediante el protocolo MQTT.
        - **"localhost"**:localhost from the broker.

```
sudo ip link set can0 up type can bitrate 250000
```

## Can Data
```
can0 0CF00400#FFFF7D0000FF0FFF
```

Hexagesinal

```
0x0CF00401
```

Convertir a Binario
```
0  C  F  0  0  4  0  1
0000 1100 1111 0000 0000 0100 0000 0001
```
SAE J1939
Separar solo 29 bits
```
xxx0 1100 1111 0000 0000 0100 0000 0001
```
Se puede hacer utilizando una mascara de Bits
HEX Mask: 0x03FFFF00
```
0  3  F  F  F  F  0  0  
0000 0011 1111 1111 1111 1111 0000 0000
```

Tomamos el PGN Segun SAE J1939, del bit 8 al 25, <-

```
xxx- --00 1111 0000 0000 0100 ---- ----
```
### PGN
Completamos de Ceros y convertimos a hexagesimal
```
--00 1111 0000 0000 0100
0000 1111 0000 0000 0100
F  0  0  4
0xF004
```

PGN en Decimales
```
61444
```

### Source Address

Tomar los primeros 8 bits
```
xxx0 1100 1111 0000 0000 0100 0000 0001
```

```
0000 0001
0 1
```

### Data Byte

64 bits - 8 bytes
```
FFFF7D0000FF0FFF
FF  FF  7D  68  13  FF  0F  FF
```

```
1.1 4 bits = -F
2 1 byte = 0F 
3 1 byte = FF
4-5 2 byte = 68  13
6 1 byte = 7D
7.1 4 bits = -F
8 1 byte = FF
```

#### SPN 190
Littel endian
```
68 13
0x6813
```

Have to be invert
```
0x1368
```

Converto decimal
```
4968
```

```
Valor: 0 + 0.125 * 4968 = 621 RPM
```

