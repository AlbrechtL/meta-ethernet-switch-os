# snake

A small snake game for the terminal, hidden in every Ethernet Switch OS
image. Start it from the root shell:

    snake [-c] [-w width] [-h height]

| Key                    | Action                   |
|------------------------|--------------------------|
| arrow keys, WASD, HJKL | move                     |
| `p` or space           | pause / resume           |
| `r`                    | restart after game over  |
| `q` or Ctrl-C          | quit                     |

`-c` turns on colour. `-w` and `-h` set the board size (default 40x20).

## Serial console

It works on the UART console in minicom with minicom's default terminal type
(VT102). The board size does not depend on the terminal: a serial line usually
reports its size as 0x0, and the default board fits an 80x24 screen. When a
terminal does report its size (SSH), the board shrinks to fit.

## Size

About 5 KB in the squashfs-xz rootfs. It is one C file that uses termios and
VT100 escape sequences, so it links only libc. Each tick rewrites only the
cells that changed, which keeps it responsive on slow serial lines.
