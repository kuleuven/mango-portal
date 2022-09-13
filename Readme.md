## iRODS Python based portal

### Installation (local development mode, Linux)

You need to have a valid and initialised iRODS environment for your account, the easiest is to install the iRODS icommands and execute the instructions from the iRODS landing page on either
- demo.irods.t.icts.kuleuven.be
- icts.irods.t.icts.kuleuven.be
- icts.irods.q.icts.kuleuven.be
- icts.irods-t.hpc.kuleuven.be
- icts.irods-q.hpc.kuleuven.be
- tier1-pilot.irods-q.hpc.kuleuven.be
- irods.hpc.kuleuven.be (production)

The current version is developed with python 3.10, but 3.8 and 3.9 probably will work as well. See also the section on changing the python version below.



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

### Starting the development server

Make sure you activated the virtual environment

Launch the flask development server from the src directory:
```sh
$ cd src
$ ./run_dev.sh
```
or

```sh
$ src/run_dev.sh
```

Point your browser to `http://localhost:5000`

### Updating

Check for new required python modules and or versions

```
$ pip3 install -r requirements.txt
```

If you encounter javascript related errors, the Vue javascript based code may need an update:

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

### Installation using the docker image

[TBD}]

### Installation ICTS cloud

[TBD]

### Technical:
- backend framework: Flask
- frontend framework: Vue.js (but not too much)
- code organisation: Flask blueprints for making things modular
- leverage the irods-Python client
- if available and desirable, talk directly to Elastic search to speed up some queries and to leverage all the Lucene search goodies
- uses its own (MySQL) database to store sessions and possibly non irods data
