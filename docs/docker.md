# Run in a development Docker container

An alternative way to run the application for development purposes is in a Docker container. This is useful if you don’t
want to install Node on your host machine.

Start by cloning the repository:

    git clone https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
    cd network-of-terms

Then start run the development container:

    docker compose run --service-ports --rm node

And execute the commands that you find in each package’s readme (for example
[GraphQL](../packages/network-of-terms-graphql/) or [Reconciliation](../packages/network-of-terms-reconciliation)):

    # In the container:
    /app # npm install
    /app # npx nx serve network-of-terms-graphql

    # or:

    /app # npx nx serve network-of-terms-reconciliation

You can also use this method if you want to run the application on an
[Apple silicon](https://support.apple.com/en-gb/HT211814) computer without emulation, as our ready-made Docker images
don’t yet support M1.

If you just want to run the application, please refer to our ready-made
[Docker images](https://github.com/orgs/netwerk-digitaal-erfgoed/packages?repo_name=network-of-terms).
