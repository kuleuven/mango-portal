function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

function clearListBS() {
  console.log('Clearing List');
  let autocompleteBSDiv = document.getElementById("autocompleteBS-list");
  if( autocompleteBSDiv != null ) autocompleteBSDiv.remove();
}

function addResultsBS(config, results) {
  console.log('Add Results');
  clearListBS();
  const newDiv = document.createElement('div');
  const sourceBS = config.inputSource;
  console.log(sourceBS.id);

  newDiv.classList.add("autocompleteBS-items");
  newDiv.setAttribute('data-forinputbs', sourceBS.id);
  newDiv.setAttribute('data-current', -1);
  newDiv.setAttribute('data-results', results.length);

  console.log(results);

  if ( results.length === 0 ) {
    console.log('No Matches - Push a Message onto Results');
  }
  newDiv.id = "autocompleteBS-list";
  let resultCounter = 0;
  
  results.forEach( function(result) {
    // console.log(result);
    let listDiv = document.createElement('div');
    let listSpan = document.createElement('span');
    let listInput = document.createElement('input');

    listDiv.innerHTML = result[config.fetchMap.id];
    listSpan.innerHTML = result[config.fetchMap.name];

    listInput.id = 'autoBS-' + resultCounter;
    listInput.setAttribute('value', result[config.fetchMap.name]);
    listInput.setAttribute('data-id', result[config.fetchMap.id]);
    listInput.setAttribute('data-resultid', resultCounter);
    listInput.hidden = true;

    // console.log(listInput);

    listDiv.prepend(listSpan);
    listDiv.append(listInput);
    newDiv.append(listDiv);
    resultCounter++;
    // console.log(newDiv);

  });

    newDiv.addEventListener("click", function(e) {
      console.log('Autocomplete List Click Event');
      console.log(e.target);

      const autocompleteBSDiv = document.getElementById("autocompleteBS-list");
      let totalResults = parseInt(autocompleteBSDiv.dataset.results);
      let inputSource = autocompleteBSDiv.dataset.forinputbs;

      if ( totalResults === 0 ) {
        console.log('not a valid entry');
        document.getElementById(inputSource).focus();
        return;
      }
     
      let selectedElement = e.target;

      if (e.target.localName !== "div") selectedElement = e.target.parentElement; 
      let selectedValue = selectedElement.querySelector('input');
      config.inputSource.value = selectedValue.value;
      config.targetID.value = selectedValue.dataset.id;
      if ('function' === typeof window.resultHandlerBS) {
        resultHandlerBS(config.name, results[selectedValue.dataset.resultid]);
      }
      clearListBS();
    });

  console.log('Add autocompleteBS-list Input Source: ' + sourceBS.id);

  // console.log(newDiv);
  sourceBS.parentElement.append(newDiv);

  }

function handleInputBS(e, config) {
  console.log('handleInputBS');
  let inputValue = e.target.value;
  
  if ( inputValue.length < config.minLength ) {
    clearListBS();
    return;
  }

  console.log(e);
  console.log(config);

  //let fetchURL = str.replace(config.fetchURL);
  let fetchURL = config.fetchURL.replace('{term}', encodeURIComponent(inputValue));
  console.log(fetchURL)

  //fetch(config.fetchURL + '?term='+ encodeURIComponent(inputValue) )
  fetch(fetchURL )
  .then(response => response.json())
  .then(response => {
      results = response;
      console.log(results);
      if ( !Array.isArray(results) ) {
        console.log('Was expecting an array from the Fetch API - Setting to Empty');
        results = [];
      }
      if ( results.length > config.maxResults ) results.length = config.maxResults;
      addResultsBS(config, results);
  })
  .catch(error => console.error('Error:', error)); 

}

function handleKeyDownBS(e, config) {

  const autocompleteBSDiv = document.getElementById("autocompleteBS-list");
  const sourceBS = config.inputSource;
  
  if ( ! autocompleteBSDiv ) return;

  let currentPosition = parseInt(autocompleteBSDiv.dataset.current);
  let totalResults = parseInt(autocompleteBSDiv.dataset.results);

  if ( autocompleteBSDiv.dataset.forinputbs == e.target.id ) {
    console.log('Key Pressed: ' + e.keyCode);

    let keyPressed = parseInt(e.keyCode);
    let keyAction = '';

    if ( keyPressed === 40 || keyPressed === 9 ) keyAction = 'down'
    if ( keyPressed === 38 || (e.shiftKey && keyPressed == 9) ) keyAction = 'up'
    if ( keyPressed === 13 ) keyAction = 'enter';
    if ( keyPressed === 27 ) keyAction = 'escape';

    if ( keyAction === 'enter' && totalResults > 0 && currentPosition === -1 ) keyAction = 'down';

    if (keyAction) console.log(keyAction);
  
    switch ( keyAction ) {
      case 'down':
        e.preventDefault();
        if ( totalResults === 0 ) return;
        if ( currentPosition === -1 ) {
          currentPosition = 1;
        } else {
          currentPosition++;
        }
        if ( currentPosition > totalResults ) currentPosition = 1;
        console.log('New Position: ' + currentPosition);
        autocompleteBSDiv.dataset.current = currentPosition;
        setPositionBS(config, currentPosition);
        break;
      case 'up':
        e.preventDefault();
        if ( totalResults === 0 ) return;
        if ( currentPosition === -1 ) {
          currentPosition = 1;
        } else {
          currentPosition--;
        }
        if ( currentPosition < 1 ) currentPosition = totalResults;
        console.log('New Position: ' + currentPosition);
        autocompleteBSDiv.dataset.current = currentPosition;
        setPositionBS(config, currentPosition);
        break;
      case 'enter':
        e.preventDefault();
        if ( totalResults === 0 ) return;
        console.log(currentPosition);
        config.targetID.value = results[currentPosition - 1][config.fetchMap.id];
        clearListBS();
        if ('function' === typeof window.resultHandlerBS) {
          resultHandlerBS(config.name, results[currentPosition - 1]);
        }
        break;
      case 'escape':
        e.preventDefault();
        config.inputSource.value = '';
        config.targetID.value = '';
        clearListBS();
        break;
    }
  } else {
    console.log('No Key Action');     
  }

}

function setPositionBS(config, positionBS) {
  console.log('setPositionBS');
  const autocompleteBSDiv = document.getElementById("autocompleteBS-list");
  if ( ! autocompleteBSDiv ) return;

  const listItems = Array.from(autocompleteBSDiv.children);

  listItems.forEach( function(listItem) {
    let selectedValue = listItem.querySelector('input');
    // console.log(selectedValue.dataset.resultid);
    if ( parseInt(selectedValue.dataset.resultid) == positionBS - 1 ) {
      listItem.classList.add("autocompleteBS-active");
      config.inputSource.value = selectedValue.value;
    } else {
      listItem.classList.remove("autocompleteBS-active");
    }
  });
  
}

function clickCheckBS(e, config) {

   const autocompleteBSDiv = document.getElementById("autocompleteBS-list");
   console.log('clickCheckBS - Document Click Handler');

   if ( ! autocompleteBSDiv ) return;

   let sourceBS = autocompleteBSDiv.dataset.forinputbs;

   if ( sourceBS == e.target.id ) {
     console.log('Clicked in Target: ' + sourceBS);
   } else {
     console.log('Clicked outside target with an active list - Send back to input');
     document.getElementById(sourceBS).focus();
   }

}


function autocompleteBS(configBS) {

  // General Document Level Click Hander
  document.addEventListener('click',  function(e) { clickCheckBS(e); } );

  configBS.forEach( function(config) {
    
    var updateValueDebounce = debounce(function(e) {
      handleInputBS(e, config);
    }, config.debounceMS);

    console.log(config.inputSource);
    config.inputSource.addEventListener('input', updateValueDebounce);
    config.inputSource.addEventListener('keydown',  function(e) { handleKeyDownBS(e,config); } );
    
  });

}


