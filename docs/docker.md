# Run in a development Docker container

An alternative way to run the application for development purposes is in a Docker container. This is useful if you don’t
want to install Node on your host machine.

Start by cloning the repository:

    git clone https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
    cd network-of-terms    

Then start run the development container:

    docker compose run --rm node

And execute the commands that you find in each package’s readme (for example 
[GraphQL](../packages/network-of-terms-graphql/) or [Reconciliation](../packages/network-of-terms-reconciliation)):

    # In the container:
    /app # npm install
    /app # cd packages/network-of-terms-graphql
    /app/packages/network-of-terms-graphql # npm run dev

    # or:

    /app # cd packages/network-of-terms-reconciliation
    /app/packages/network-of-terms-reconciliation # npm run dev

If you just want to run the application, please refer to our ready-made
[Docker images](https://github.com/orgs/netwerk-digitaal-erfgoed/packages?repo_name=network-of-terms).
