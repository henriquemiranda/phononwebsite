/* 
Get combintations 2 by two based on:
http://stackoverflow.com/questions/29169011/javascript-arrays-finding-the-number-of-combinations-of-2-elements
*/

getCombinations =  function(elements) {
    combos = [];
    for (var i = 0; i < elements.length; i++)
        for (var j = i + 1; j < elements.length; j++)
            combos.push([elements[i], elements[j]]);
    return combos;
}
