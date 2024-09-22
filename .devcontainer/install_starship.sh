#!/bin/bash

# shellcheck source=.devcontainer/colours.sh
source "$(dirname "$0")/colours.sh"

function install_starship() {

    echo -e "${BLUE}Installing nerdfont...${RESET}"
    # install Nerd Font
    if ! curl -sS https://webi.sh/nerdfont | sh
    then
        echo -e "${RED}Nerdfont install failed.${RESET}"
        exit 1
    fi

    echo -e "${GREEN}Nerdfont installed.${RESET}"
    echo ""

    # install starship
    echo -e "${BLUE}Installing starship...${RESET}"
    echo ""
    curl -sS https://starship.rs/install.sh -o /tmp/install.sh

    if [[ -f /tmp/install.sh ]]
    then
        chmod +x /tmp/install.sh
        if ! /tmp/install.sh -y
        then
            echo -e "${RED}Starship install failed.${RESET}"
            exit 1
        fi
        rm -f /tmp/install.sh
    else
        echo -e "${RED}Starship install failed.${RESET}"
        exit 1
    fi

    # set style

    echo -e "${GREEN}$(starship --version | head -n 1) installed.${RESET}"
    echo ""

}