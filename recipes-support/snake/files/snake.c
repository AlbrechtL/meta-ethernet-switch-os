/*
 * snake -- a terminal snake game for Ethernet Switch OS.
 *
 * SPDX-License-Identifier: MIT
 *
 * This code was written entirely by an AI (Claude Opus 5.5, Anthropic).
 *
 * No ncurses: raw termios and VT100 escape sequences, so it links only libc
 * and runs on anything minicom, screen or an SSH client can show. On a UART
 * (115200 baud is about 11 KB/s) a full redraw per tick would lag, so the
 * frame is drawn once and each tick only rewrites the few cells that changed.
 * The board size is fixed rather than taken from the terminal: over a serial
 * line TIOCGWINSZ usually reports 0x0.
 */
#include <errno.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <time.h>
#include <unistd.h>

#define MAXW 76
#define MAXH 40
#define MINW 10
#define MINH 5

enum { UP, DOWN, LEFT, RIGHT };

static int W = 40, H = 20, color;
static struct termios saved_tio;
static char below[32]; /* cursor to below the board, for restore() */
static int below_len;

static unsigned short body[MAXW * MAXH]; /* ring buffer, tail .. head */
static unsigned char occ[MAXW * MAXH];   /* cell holds a body part */
static int tail, len, dir, next_dir, food, score, dead, paused, won;

static char ob[4096];
static size_t on;

static void flush(void)
{
	size_t off = 0;

	while (off < on) {
		ssize_t n = write(STDOUT_FILENO, ob + off, on - off);
		if (n < 0 && errno == EINTR)
			continue;
		if (n <= 0)
			break;
		off += n;
	}
	on = 0;
}

static void out(const char *s)
{
	size_t n = strlen(s);

	if (on + n > sizeof(ob))
		flush();
	memcpy(ob + on, s, n);
	on += n;
}

static void at(int row, int col)
{
	char s[32];

	snprintf(s, sizeof(s), "\033[%d;%dH", row, col);
	out(s);
}

/* Board cells are 0-based; the frame occupies screen row/column 1. */
static void cell(int pos, const char *attr, char c)
{
	char s[2] = { c, 0 };

	at(pos / W + 2, pos % W + 2);
	if (color && attr)
		out(attr);
	out(s);
	if (color && attr)
		out("\033[0m");
}

static void restore(void)
{
	/* Only async-signal-safe calls: this also runs from the signal handler. */
	static const char bye[] = "\033[0m\033[?25h\r\n";

	/* Nothing sensible to do when the terminal is gone. */
	if (write(STDOUT_FILENO, below, below_len) < 0 ||
	    write(STDOUT_FILENO, bye, sizeof(bye) - 1) < 0) {
	}
	tcsetattr(STDIN_FILENO, TCSAFLUSH, &saved_tio);
}

static void on_signal(int sig)
{
	(void)sig;
	restore();
	_exit(1);
}

static void status(void)
{
	char s[96];

	at(H + 3, 1);
	if (won)
		snprintf(s, sizeof(s), "You win! Score %d  r restart, q quit", score);
	else if (dead)
		snprintf(s, sizeof(s), "GAME OVER  Score %d  r restart, q quit", score);
	else if (paused)
		snprintf(s, sizeof(s), "Paused  Score %d  p resume", score);
	else
		snprintf(s, sizeof(s), "Score %d  Length %d", score, len);
	out(s);
	out("\033[K");
}

static void place_food(void)
{
	int free_cells = W * H - len, n, i;

	if (free_cells == 0) {
		won = 1;
		food = -1;
		return;
	}
	n = rand() % free_cells;
	for (i = 0; i < W * H; i++)
		if (!occ[i] && n-- == 0)
			break;
	food = i;
	cell(food, "\033[1;31m", '*');
}

static void new_game(void)
{
	int x, y, i;

	memset(occ, 0, sizeof(occ));
	tail = 0;
	len = 3;
	dir = next_dir = RIGHT;
	score = dead = paused = won = 0;

	out("\033[0m\033[2J\033[H");
	for (y = 0; y < H + 2; y++) {
		at(y + 1, 1);
		for (x = 0; x < W + 2; x++)
			out((y == 0 || y == H + 1 || x == 0 || x == W + 1) ? "#" : " ");
	}
	at(H + 4, 1);
	out("arrows/WASD/HJKL move  p pause  q quit");

	for (i = 0; i < len; i++) {
		body[i] = (H / 2) * W + W / 4 + i;
		occ[body[i]] = 1;
		cell(body[i], "\033[32m", i == len - 1 ? '@' : 'o');
	}
	place_food();
	status();
	flush();
}

static void step(void)
{
	int head = body[(tail + len - 1) % (W * H)];
	int x = head % W, y = head / W, np;

	dir = next_dir;
	switch (dir) {
	case UP:    y--; break;
	case DOWN:  y++; break;
	case LEFT:  x--; break;
	case RIGHT: x++; break;
	}
	if (x < 0 || x >= W || y < 0 || y >= H) {
		dead = 1;
		status();
		return;
	}
	np = y * W + x;

	if (np == food) {
		score++;
	} else {
		/* The tail moves away first, so chasing it is not a collision. */
		occ[body[tail]] = 0;
		cell(body[tail], NULL, ' ');
		tail = (tail + 1) % (W * H);
		len--;
	}
	if (occ[np]) {
		dead = 1;
		status();
		return;
	}
	cell(head, "\033[32m", 'o');
	body[(tail + len) % (W * H)] = np;
	occ[np] = 1;
	len++;
	cell(np, "\033[1;32m", '@');
	if (np == food)
		place_food();
	status();
}

static void turn(int d)
{
	static const int opposite[] = { DOWN, UP, RIGHT, LEFT };

	if (!dead && !paused && d != opposite[dir])
		next_dir = d;
}

/* Returns 0 to quit. The escape state survives across reads: over a serial
 * line an arrow key's three bytes do not always arrive together. */
static int key(unsigned char c)
{
	static int esc;

	if (esc == 1) {
		esc = (c == '[' || c == 'O') ? 2 : 0;
		return 1;
	}
	if (esc == 2) {
		esc = 0;
		switch (c) {
		case 'A': turn(UP); break;
		case 'B': turn(DOWN); break;
		case 'C': turn(RIGHT); break;
		case 'D': turn(LEFT); break;
		}
		return 1;
	}
	switch (c) {
	case 27: esc = 1; break;
	case 'w': case 'W': case 'k': turn(UP); break;
	case 's': case 'S': case 'j': turn(DOWN); break;
	case 'a': case 'A': case 'h': turn(LEFT); break;
	case 'd': case 'D': case 'l': turn(RIGHT); break;
	case 'p': case 'P': case ' ':
		if (!dead && !won) {
			paused = !paused;
			status();
		}
		break;
	case 'r': case 'R':
		if (dead || won)
			new_game();
		break;
	case 'q': case 'Q': case 3: /* Ctrl-C, ISIG is off */
		return 0;
	}
	return 1;
}

static long long now_ms(void)
{
	struct timespec ts;

	clock_gettime(CLOCK_MONOTONIC, &ts);
	return ts.tv_sec * 1000LL + ts.tv_nsec / 1000000;
}

static void usage(void)
{
	fprintf(stderr, "usage: snake [-c] [-w width] [-h height]\n"
		"  -c  colour\n"
		"  -w  board width, %d..%d (default 40)\n"
		"  -h  board height, %d..%d (default 20)\n",
		MINW, MAXW, MINH, MAXH);
	exit(2);
}

int main(int argc, char **argv)
{
	struct termios tio;
	struct winsize ws;
	long long next;
	int opt;

	while ((opt = getopt(argc, argv, "cw:h:")) != -1) {
		switch (opt) {
		case 'c': color = 1; break;
		case 'w': W = atoi(optarg); break;
		case 'h': H = atoi(optarg); break;
		default: usage();
		}
	}
	/* Shrink to fit when the terminal knows its size; a serial console
	 * usually reports 0x0 and keeps the requested size. */
	if (ioctl(STDOUT_FILENO, TIOCGWINSZ, &ws) == 0 && ws.ws_col && ws.ws_row) {
		if (W > ws.ws_col - 2)
			W = ws.ws_col - 2;
		if (H > ws.ws_row - 4)
			H = ws.ws_row - 4;
	}
	if (W < MINW || W > MAXW || H < MINH || H > MAXH) {
		fprintf(stderr, "snake: board must be %d..%d x %d..%d (terminal too small?)\n",
			MINW, MAXW, MINH, MAXH);
		return 1;
	}
	if (!isatty(STDIN_FILENO) || tcgetattr(STDIN_FILENO, &saved_tio) < 0) {
		fprintf(stderr, "snake: stdin is not a terminal\n");
		return 1;
	}

	below_len = snprintf(below, sizeof(below), "\033[%d;1H", H + 5);
	signal(SIGTERM, on_signal);
	signal(SIGHUP, on_signal);
	tio = saved_tio;
	tio.c_lflag &= ~(ICANON | ECHO | ISIG | IEXTEN);
	tio.c_iflag &= ~(IXON | ICRNL);
	tio.c_cc[VMIN] = 0;
	tio.c_cc[VTIME] = 0;
	tcsetattr(STDIN_FILENO, TCSAFLUSH, &tio);
	out("\033[?25l");

	srand(time(NULL) ^ getpid());
	new_game();

	next = now_ms();
	for (;;) {
		struct pollfd pfd = { STDIN_FILENO, POLLIN, 0 };
		int delay = 150 - 3 * score, timeout = -1;
		long long t = now_ms();

		if (delay < 60)
			delay = 60;
		if (!dead && !paused && !won) {
			if (t >= next) {
				step();
				flush();
				next = t + delay;
			}
			timeout = next - t > 0 ? (int)(next - t) : 0;
		}
		if (poll(&pfd, 1, timeout) > 0) {
			unsigned char buf[32];
			ssize_t n = read(STDIN_FILENO, buf, sizeof(buf)), i;

			if (n == 0 || (pfd.revents & (POLLHUP | POLLERR)))
				break;
			for (i = 0; i < n; i++)
				if (!key(buf[i]))
					goto quit;
			flush();
			if (paused || dead || won)
				next = now_ms() + delay;
		}
	}
quit:
	flush();
	restore();
	return 0;
}
