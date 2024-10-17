#!/bin/bash

# shellcheck source=.devcontainer/colours.sh
source "$(dirname "$0")/colours.sh"

# This script initializes PyEnv, a Python version management tool.
# It sets the PYENV_ROOT environment variable to the user's home directory,
# adds PyEnv to the system PATH if it's not already present,
# and initializes PyEnv by evaluating its initialization script.
# The script also prints messages to indicate the start and completion of the initialization process.
function Initialise_pyenv() {

    echo -e "${BLUE}Initialise PyEnv...${RESET}"
    echo ""

    export PYENV_ROOT="/root/.pyenv"
    command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init -)"

    setfacl -m u:node:rx /root

    echo -e "${GREEN}PyEnv initialised.${RESET}"
    echo ""

}

function install_pyenv() {

    echo -e "${BLUE}Installing pyenv...${RESET}"

    ROOT_PYENV=/root/.pyenv
    if [[ -d $ROOT_PYENV ]]
    then
        echo -e "${YELLOW}PyEnv root directory already exists. Removing...${RESET}"
        rm -rf $ROOT_PYENV
        echo -e "...removed."
        echo -e ""
    fi

    # install Nerd Font
    if ! curl https://pyenv.run | bash
    then
        echo -e "${RED}PyEnv install failed.${RESET}"
        exit 1
    fi

    echo -e "${GREEN}PyEnv installed.${RESET}"
    echo ""

    if ! Initialise_pyenv
    then
        echo -e "${RED}PyEnv initialisation failed.${RESET}"
        exit 1
    fi

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