const pi = 3.14159265359;

function getCombination(selements) {
    /* 
    Get combintations 2 by two based on:
    http://stackoverflow.com/questions/29169011/javascript-arrays-finding-the-number-of-combinations-of-2-elements
    */
    combos = [];
    for (var i = 0; i < elements.length; i++)
        for (var j = i + 1; j < elements.length; j++)
            combos.push([elements[i], elements[j]]);
    return combos;
}

function subscript_numbers(old_string) {
    string = "";
    for (a of old_string) {
        if (!isNaN(a)) {
            string += "<sub>"+a+"</sub>";
        }
        else {
            string += a;
        }
    }
    return string;
}


