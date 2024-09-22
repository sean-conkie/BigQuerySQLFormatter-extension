#!/bin/bash

# shellcheck source=$HOME/.git-completion.bash
if [ -f ~/.git-completion.bash ]; then
  . ~/.git-completion.bash
fi

alias ll="ls -la"

export PATH=$PATH:/opt/python/3.12/bin

eval "$(starship init bash)"

