class Manager:
    """ Base class for 'managers' that are attached to a VSCiRODSSession """

    def __init__(self, session):
        self.session = session

    def log(self, *args, **kwargs):
        self.session.log(*args, **kwargs)
