## ManGO: an iRODS Python Client based portal

> WARNING: the current state is geared towards deployments in the KU Leuven specific cloud services, see [Custom deployments](Custom-deployments.md) for your options. In the near future, the KU Leuven specifics will be entirely decoupled from the generic code base so a default installation will work with a vanilla iRODS installation 

### Installation (local development mode, Linux)

You need to have a valid and initialised iRODS environment for your account, the easiest is to install the iRODS icommands and execute the instructions from the iRODS landing page on either
- demo.irods.t.icts.kuleuven.be
- icts.irods.t.icts.kuleuven.be
- icts.irods.q.icts.kuleuven.be
- icts.irods-t.hpc.kuleuven.be
- icts.irods-q.hpc.kuleuven.be
- tier1-pilot.irods-q.hpc.kuleuven.be
- irods.hpc.kuleuven.be (production)

> The current version requires python 3.10 or higher. See also the section on changing the python version below.

Create a python virtual environment in the root of this repository checkout and install the required modules, for example

```sh
$ python3 -m venv venv
$ . venv/bin/activate
$ pip3 install -r requirements.txt
```

### Vue2.js development and building

Currently the node module parcel and its dependencies are required for building, see https://parceljs.org/

Before using the first time, execute the following steps

```sh
$ cd src
$ npm install
$ npm run build
```

### Starting the development server (waitress version, recommended)

Make sure you activated the virtual environment

Launch the flask development server from the src directory:
```sh
$ cd src
$ ./run_waitress.sh
```
or

```sh
$ src/run_waitress.sh
```

This will start waitress as used in the production deployments, but adds a listener for reloading the app when you change files locally.

Point your browser to `http://localhost:3000`

### Updating

Check for new required python modules and or versions

```
$ pip3 install -r requirements.txt
```

If you encounter javascript related errors, the used js files may need an update:

```sh
$ cd src
$ npm install
$ npm run build
```

### Changing the python version

If you upgrade your python version, the requirements.txt may not be correct anymore (outdated packages). You can install updated python modules with:

```sh
$ pip list --outdated --format=freeze | grep -v '^\-e' | \
 cut -d = -f 1  | xargs -n1 pip install -U
```

### Technical:

- backend framework: Flask
- code organisation: Flask blueprints for making things modular
- leverage the irods-Python client
- optional OpenSearch integration

## Development guidelines

### Python

The preferred formatter is _black_ with its default options, it also has an integration with IDE's such as VSCode

### Javascript

The preferred formatter is _prettier_ with indenting to 4 spaces, no TAB's and single quotes for strings
