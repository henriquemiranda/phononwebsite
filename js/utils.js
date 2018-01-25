pi = 3.14159265359;

function getCombinations(elements) {
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

function rec_lat(lat) {
    /* Calculate the reciprocal lattice
    */
    let a1 = lat[0];
    let a2 = lat[1];
    let a3 = lat[2];
    let b1 = vec_cross(a2,a3);
    let b2 = vec_cross(a3,a1);
    let b3 = vec_cross(a1,a2);
    let v = vec_dot(a1,b1);
    b1 = vec_scale(b1,1/v);
    b2 = vec_scale(b2,1/v);
    b3 = vec_scale(b3,1/v);
    return [b1,b2,b3] 
}

function point_in_list(point,points) {
    /* 
    Return the index of the point if it is present in a list of points
    */
    for (let i=0; i<points.length; i++) {
        if (distance(point,points[i]) < 1e-4) {
            return {found:true,index:i};
        }
    }
    return {found:false};
}

function red_car_list(red,lat) {
    let car = [];
    for (let i=0; i<red.length; i++) {
        car.push(red_car(red[i],lat));
    }
    return car;
}

function get_formula(atom_types) {
    //create the name from the elements
    //from https://stackoverflow.com/questions/15052702/count-unique-elements-in-array-without-sorting
    let counts = {};
    for (var i = 0; i < atom_types.length; i++) {
        counts[atom_types[i]] = 1 + (counts[atom_types[i]] || 0);
    }

    //make the name from the counter
    name = "";
    for (let element in counts) {
        name += element+counts[element];
    }
    return name;
}

function getReasonableRepetitions(natoms,lat) {
    /*
    choose a reasonable number of repetitions
    Some logic can be implemented here to improve 
    in which directions the repetitions are made
    */

    if (natoms < 4)        { return [3,3,3] };
    if (4 < natoms < 15)   { return [2,2,2] };
    if (15 < natoms < 50)  { return [2,2,1] };
    if (50 < natoms)       { return [1,1,1] };

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
