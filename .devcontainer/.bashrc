#!/bin/bash


if [ -f ~/.git-completion.bash ]; then
  . ~/.git-completion.bash
fi

alias ll="ls -la"

export PATH=$PATH:/opt/python/3.12/bin

eval "$(starship init bash)"

# Generated for envman. Do not edit.
[ -s "$HOME/.config/envman/load.sh" ] && source "$HOME/.config/envman/load.sh"
