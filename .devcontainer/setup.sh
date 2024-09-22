#!/bin/bash

# shellcheck source=.devcontainer/colours.sh
source "$(dirname "$0")/colours.sh"
# shellcheck source=.devcontainer/install_starship.sh
source "$(dirname "$0")/install_starship.sh"


echo -e "${PURPLE}#########################################${RESET}"
echo -e "${PURPLE}Setting up devcontainer...${RESET}"
echo -e "${PURPLE}#########################################${RESET}"
echo ""

echo -e "${BLUE}Update apt...${RESET}"
sudo apt update -q
echo -e "${GREEN}Apt updated.${RESET}"
echo ""

echo -e "${BLUE}Installing git autocomplete...${RESET}"
GIT_AUTOCOMPLETE=/home/node/.git-completion.bash
# add bash autocompletion
curl https://raw.githubusercontent.com/git/git/master/contrib/completion/git-completion.bash -o $GIT_AUTOCOMPLETE

if [[ $? -ne 0 ]]
then
    echo -e "${RED}git autocompletion download failed.${RESET}"
    exit 1
else

    chmod +x $GIT_AUTOCOMPLETE
    if [[ $? -ne 0 ]]
    then
        echo -e "${RED}Failed to set permissions on ${GIT_AUTOCOMPLETE}.${RESET}"
        exit 1
    fi
fi

echo -e "${GREEN}Git autocomplete installed.${RESET}"
echo ""


# install starship prompt
install_starship

# add yeoman
echo -e "${BLUE}Installing Yeoman...${RESET}"
npm install --global yo generator-code
if [[ $? -ne 0 ]]
then
    echo -e "${RED}Failed to install yeoman.${RESET}"
    exit 1
fi
echo -e "${GREEN}Yeoman installed.${RESET}"
echo ""

# add vsce
echo -e "${BLUE}Installing VSCE...${RESET}"
npm install -g @vscode/vsce
if [[ $? -ne 0 ]]
then
    echo -e "${RED}Failed to install VSCE.${RESET}"
    exit 1
fi
echo -e "${GREEN}VSCE installed.${RESET}"
echo ""

# add markdownlint
echo -e "${BLUE}Installing markdownlint...${RESET}"
npm install -g markdownlint-cli
if [[ $? -ne 0 ]]
then
    echo -e "${RED}Failed to install markdownlint.${RESET}"
    exit 1
fi
echo -e "${GREEN}markdownlint installed.${RESET}"
echo ""

# add shellcheck
echo -e "${BLUE}Installing shellcheck...${RESET}"
apt install shellcheck
if [[ $? -ne 0 ]]
then
    echo -e "${RED}Failed to install shellcheck.${RESET}"
    exit 1
fi
echo -e "${GREEN}shellcheck installed.${RESET}"
echo ""

echo -e "${PURPLE}#########################################${RESET}"
echo -e "${PURPLE}Setup complete!!${RESET}"
echo -e "${PURPLE}#########################################${RESET}"
echo ""

