# Run in a development Docker container

An alternative way to run the application for development purposes is in a Docker container. This is useful if you don’t want to install Node on your host machine. 

Start by cloning the repository:

    git clone https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
    cd network-of-terms    

To run the GraphQL API run the development container using the following command:

    docker compose -f docker-compose-graphql.yml run -p 8080:3123 --rm grapql

The API will (after a few seconds) be available on localhost:8080. 
You can change the port number 8080 to your own preference. 

To run the Reconciliaton API run the development container using the following command:

    docker compose -f docker-compose-reconciliation.yml run -p 8080:3123 --rm reconciliation

Note that you need to restart the docker compose after every change in the code. 

If you just want to run the application, please refer to our ready-made
[Docker images](https://github.com/orgs/netwerk-digitaal-erfgoed/packages?repo_name=network-of-terms).

You can also use the method above if you want to run the application on an
[Apple silicon](https://support.apple.com/en-gb/HT211814) computer without emulation, as our ready-made Docker images
don’t yet support M1.