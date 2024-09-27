#!/bin/bash

# shellcheck source=.devcontainer/colours.sh
source "$(dirname "$0")/colours.sh"

function install_pyenv() {

    echo -e "${BLUE}Installing pyenv...${RESET}"
    # install Nerd Font
    if ! curl https://pyenv.run | bash
    then
        echo -e "${RED}PyEnv install failed.${RESET}"
        exit 1
    fi

    echo -e "${GREEN}PyEnv installed.${RESET}"
    echo ""

    # install python
    echo -e "${BLUE}Installing 3.12...${RESET}"
    echo ""
    if ! pyenv install 3.12
    then
        echo -e "${RED}Python 3.12 install failed.${RESET}"
        exit 1
    fi

    if ! pyenv global 3.12
    then
        echo -e "${RED}Python 3.12 global failed.${RESET}"
        exit 1
    fi

    # set style

    echo -e "${GREEN}$(python --version) installed.${RESET}"
    echo ""

}