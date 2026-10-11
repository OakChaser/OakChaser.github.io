# Help

This site is a terminal. Documents are commands — `index`, `help`, `repos` —
and tools live in `/bin`.

## commands

- `ls [dir]`    list a directory (try `ls /bin`)
- `cat <path>`  print a document (no clear; pipe-friendly)
- `head [path]` first lines (`head -n 5 index`, `cat index | head`)
- `tail [path]` last lines (`tail -n 3 index`)
- `grep <pat>`  filter lines (`cat index | grep foo`)
- `find [path]` walk the FS (`find /bin -type f`, `find -name repos`)
- `tree [path]` draw the FS as a tree
- `more [path]` page a document or stdin (space/b/q)
- `less [path]` same pager, with PageUp/PageDown
- `cd <dir>`    change directory (`cd /bin`, `cd ..`, `cd /`)
- `clear`       clear the screen
- `wc`          count lines/words/bytes from stdin
- `cowsay <msg>`  the cow says it (also reads stdin)
- `fastfetch`   print a (fake) system summary
- `reboot`      reload the page
- `poweroff`    close the tab (best effort)
- `exit`        return to the home page (same as Ctrl-D on an empty line)

## tips

- Run a page like `index` to open it (clears the screen).
- Pipes work: `cat index | wc -l`.
- Paths: `./repos`, `/help`, `../`.
- History: ↑/↓ or Ctrl-P/N. Cancel: Ctrl-C. Clear: Ctrl-L.
- Completion: Tab lists and cycles candidates; Shift-Tab cycles backwards.
