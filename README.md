# A terminal-style homepage

A personal site that pretends to be a terminal. Built on `xterm.js` with a tiny shell on top. The
compiler turns it into structured data the runtime consumes. Deployed to `oakchaser.me`.

## Usage

The site runs a shell. Commands are entered at the prompt and executed with `Enter`.

### Pages

Pages are commands: `index`, `repos`, `friends`, `wakatime`, `help`. Enter a page name to open it.
Internal links execute the corresponding command and push a history entry; browser back and forward
navigate the opened pages. Some page can be opened directly by hash, for example `/#repos`.

`cat` prints a page without clearing the screen. The output remains in scrollback and can be piped.

```sh
cat repos
cat repos | grep conic
cat index | wc -l
```

### Commands

| Command        | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| `help`         | list available commands                                     |
| `ls [dir]`     | list directory contents; `ls /bin` lists commands           |
| `cat <path>`   | print a page without clearing the screen                    |
| `head [path]`  | print the first lines; `-n N` sets the count                |
| `tail [path]`  | print the last lines; `-n N` sets the count                 |
| `grep <pat>`   | print lines matching a pattern; reads stdin without a path  |
| `find [path]`  | walk the filesystem; `-name GLOB`, `-type f\|d`             |
| `tree [path]`  | print the filesystem as a tree                              |
| `more [path]`  | page a document or stdin                                    |
| `less [path]`  | identical to `more`                                         |
| `cd <dir>`     | change directory                                            |
| `pwd`          | print the working directory                                 |
| `wc`           | count lines, words and bytes; `-l`, `-w`, `-c`; reads stdin |
| `cowsay <msg>` | print the message as ASCII art; reads stdin                 |
| `fastfetch`    | print a synthetic system summary                            |
| `whoami`       | print the user name                                         |
| `exit`         | return to the home page                                     |
| `reboot`       | reload the page                                             |
| `poweroff`     | close the tab; not guaranteed to succeed                    |

Paths resolve relative to the current directory: `./repos`, `/help`, `../`. `cd /bin` followed by
`ls` lists the executables.

### Keys

| Key                              | Action                                       |
| -------------------------------- | -------------------------------------------- |
| `Enter`                          | execute the line                             |
| `Tab` / `Shift-Tab`              | complete commands and paths; repeat to cycle |
| `Up`, `Down`, `Ctrl-P`, `Ctrl-N` | browse history                               |
| `Ctrl-C`                         | cancel the current line                      |
| `Ctrl-L`                         | clear the screen                             |
| `Ctrl-D` on an empty line        | return to the home page                      |

`more` and `less` accept the following keys:

| Key                    | Action      |
| ---------------------- | ----------- |
| `Space`, `PageDown`    | next page   |
| `b`, `PageUp`          | prev page   |
| `Up`, `Down`, `k`, `j` | scroll line |
| `q`, `Esc`             | quit        |

## Credits

`scripts/wakatime.ts` uses the template model of
[Twisuki/custom_waka_readme](https://github.com/Twisuki/custom_waka_readme): inline expression
tokens and `CUSTOM_WAKA` START/END blocks evaluated in an isolated VM. The parser, shared
block/token scope and `{{...}}` escaping derive from that project.

The site is a modification of
[jiangyy/jiangyy.github.io](https://github.com/jiangyy/jiangyy.github.io).
